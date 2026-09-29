export type WorkspaceBusinessLike = {
  business_type?: string | null;
};

const normalizedType = (business: WorkspaceBusinessLike) =>
  (business.business_type || "").trim().toLowerCase();

export const isKitchenProviderBusiness = (business: WorkspaceBusinessLike) =>
  normalizedType(business).includes("kitchen provider");

export const isChefBusiness = (business: WorkspaceBusinessLike) => {
  const type = normalizedType(business);
  return [
    "independent chef",
    "caterer",
    "baker",
    "meal-prep business",
    "food truck operator",
    "packaged-food maker",
  ].includes(type);
};
