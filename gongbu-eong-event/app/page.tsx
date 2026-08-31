import { redirect } from "next/navigation";

export default function Home() {
  redirect(
    process.env.GONGBUEONG_MAIN_URL ||
      process.env.NEXT_PUBLIC_MAIN_APP_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      "http://localhost:3000",
  );
}
