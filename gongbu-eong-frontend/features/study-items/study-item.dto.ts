export type StudyItemDto = {
  id: string;
  title: string;
  status: string;
};

export type StudyItemsResponseDto = {
  items: StudyItemDto[];
};
