export async function uploadToObjectStorage(args: {
  key: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const config = getObjectStorageConfig();

  if (!config.ok) {
    return {
      uploaded: false,
      publicUrl: null,
      reason: config.reason,
    };
  }

  const swift = await resolveSwiftConfig(config);
  if (!swift.ok) {
    return {
      uploaded: false,
      publicUrl: null,
      reason: swift.reason,
    };
  }

  return uploadWithSwiftToken({
    publicBaseUrl: swift.publicBaseUrl,
    token: swift.token,
    key: args.key,
    buffer: args.buffer,
    contentType: args.contentType || "application/octet-stream",
  });
}

type ObjectStorageConfig =
  | {
      ok: true;
      method: "swift";
      storageUrl: string;
      container: string;
      storageAccount?: string;
      token?: string;
      authUrl?: string;
      userId?: string;
      password?: string;
    }
  | {
      ok: false;
      reason: string;
    };

function getObjectStorageConfig(): ObjectStorageConfig {
  const storageAccount = process.env.NHN_OS_STORAGE;
  const storageUrl =
    process.env.NHN_OS_STORAGE_URL ||
    process.env.NHN_OBJECT_STORAGE_URL ||
    (storageAccount
      ? `https://kr1-api-object-storage.gov-nhncloudservice.com/v1/${storageAccount}`
      : undefined);
  const container = process.env.NHN_OS_CONTAINER || "gongbueong";
  const configuredToken = process.env.NHN_OS_TOKEN || process.env.NHN_OBJECT_STORAGE_TOKEN;
  const swiftToken =
    storageUrl && configuredToken && !isStorageAccountToken(configuredToken, storageUrl, storageAccount)
      ? configuredToken
      : undefined;
  const swiftUserId = process.env.NHN_OS_USERID || process.env.NHN_OS_API_ID;
  const swiftPassword =
    process.env.NHN_OS_API_PASSWORD ||
    process.env.NHN_API_PW ||
    process.env.NHN_OS_API_KEY ||
    process.env.NHN_OS_PASSWORD ||
    process.env.NHN_OBJECT_STORAGE_PASSWORD ||
    process.env.NHN_API_PASSWORD;

  // NHN Cloud Object Storage is consumed through its Swift container API.
  // Do not silently switch to S3: a configured `gongbueong` container must
  // use the same object path and credentials in local and deployed builds.
  if (storageUrl && container && (swiftToken || (swiftUserId && swiftPassword))) {
    return {
      ok: true,
      method: "swift",
      storageUrl,
      container,
      ...(storageAccount ? { storageAccount } : {}),
      ...(swiftToken ? { token: swiftToken } : {}),
      ...(swiftUserId && swiftPassword
        ? {
            authUrl: process.env.NHN_OS_AUTH_URL,
            userId: swiftUserId,
            password: swiftPassword,
          }
        : {}),
    };
  }

  return {
    ok: false,
    reason:
      "NHN_OS_STORAGE_URL, NHN_OS_CONTAINER, NHN_OS_USERID, NHN_OS_API_PASSWORD 또는 실제 NHN_OS_TOKEN이 설정되지 않았습니다. NHN AWS S3 키와 AUTH_... 스토리지 계정값은 업로드 인증 토큰으로 사용하지 않습니다.",
  };
}

async function resolveSwiftConfig(config: Extract<ObjectStorageConfig, { method: "swift" }>) {
  if (config.userId && config.password) {
    const refreshed = await requestSwiftToken(config);
    if (refreshed.ok) {
      return refreshed;
    }

    if (!config.token) {
      return refreshed;
    }
  }

  if (config.token) {
    return {
      ok: true as const,
      publicBaseUrl: appendContainer(config.storageUrl, config.container),
      token: config.token,
    };
  }

  return {
    ok: false as const,
    reason:
      "NHN Swift 인증 정보가 없습니다. NHN_OS_USERID와 NHN_OS_API_PASSWORD 또는 NHN_OS_TOKEN을 확인해 주세요.",
  };
}

async function requestSwiftToken(config: Extract<ObjectStorageConfig, { method: "swift" }>) {
  try {
    if (!config.userId || !config.password) {
      return {
        ok: false as const,
        reason: "NHN Swift 인증 정보가 없습니다. NHN_OS_USERID와 NHN_OS_API_PASSWORD를 확인해 주세요.",
      };
    }

    const errors: string[] = [];
    for (const authUrl of getSwiftAuthUrlCandidates(config)) {
      for (const authUser of getSwiftAuthUserCandidates(config)) {
        const response = await fetch(authUrl, {
          headers: {
            "X-Auth-User": authUser,
            "X-Auth-Key": config.password,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          errors.push(`${authUrl} (${maskAuthUser(authUser)}): ${response.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
          continue;
        }

        const token = response.headers.get("X-Auth-Token");
        const storageUrl = response.headers.get("X-Storage-Url") || config.storageUrl;
        if (!token) {
          errors.push(`${authUrl} (${maskAuthUser(authUser)}): X-Auth-Token 응답 헤더 없음`);
          continue;
        }

        return {
          ok: true as const,
          publicBaseUrl: appendContainer(storageUrl, config.container),
          token,
        };
      }
    }

    return {
      ok: false as const,
      reason: `NHN Swift 인증 실패: ${errors.join(" | ")}`,
    };
  } catch (error) {
    return {
      ok: false as const,
      reason: `NHN Swift 인증 요청 실패: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

function getSwiftAuthUserCandidates(config: Extract<ObjectStorageConfig, { method: "swift" }>) {
  const userId = config.userId?.trim();
  const storageAccount = config.storageAccount?.trim();
  const projectId = storageAccount?.replace(/^AUTH_/, "");
  return Array.from(
    new Set(
      [
        userId,
        storageAccount && userId ? `${storageAccount}:${userId}` : undefined,
        projectId && userId ? `${projectId}:${userId}` : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function maskAuthUser(value: string) {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function getSwiftAuthUrlCandidates(config: Extract<ObjectStorageConfig, { method: "swift" }>) {
  const explicit = config.authUrl;
  const origin = new URL(config.storageUrl).origin;
  return Array.from(
    new Set(
      [
        explicit,
        `${origin}/auth/v1.0`,
        `${origin}/v1.0`,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(/\/$/, "")),
    ),
  );
}

function isStorageAccountToken(token: string, storageUrl: string, storageAccount?: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return true;
  }

  const accountFromUrl = storageUrl.match(/\/v1\/([^/]+)/)?.[1];
  return [storageAccount, accountFromUrl]
    .filter((value): value is string => Boolean(value))
    .some((account) => account === normalizedToken);
}

function appendContainer(storageUrl: string, container: string) {
  const normalized = storageUrl.replace(/\/$/, "");
  const encodedContainer = encodeURIComponent(container);
  return normalized.endsWith(`/${encodedContainer}`) || normalized.endsWith(`/${container}`)
    ? normalized
    : `${normalized}/${encodedContainer}`;
}

async function uploadWithSwiftToken(args: {
  publicBaseUrl: string;
  token: string;
  key: string;
  buffer: Buffer;
  contentType: string;
}) {
  const url = `${args.publicBaseUrl}/${encodeObjectPath(args.key)}`;
  const response = await fetch(url, {
    method: "PUT",
    cache: "no-store",
    headers: {
      "X-Auth-Token": args.token,
      "Content-Type": args.contentType,
    },
    body: new Uint8Array(args.buffer),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      uploaded: false,
      publicUrl: null,
      reason: `NHN Object Storage upload failed: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`,
    };
  }

  return {
    uploaded: true,
    publicUrl: url,
    reason: null,
  };
}

function encodeObjectPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}
