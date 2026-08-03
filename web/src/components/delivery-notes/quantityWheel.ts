const minimumQuantity = 1;

export const quantityWheelScrollTop = (quantity: string, itemHeight: number, maximumQuantity: number) => {
  const parsedQuantity = Number.parseInt(quantity || minimumQuantity.toString(), 10);
  const clampedQuantity = Math.min(maximumQuantity, Math.max(minimumQuantity, parsedQuantity));

  return (clampedQuantity - minimumQuantity) * itemHeight;
};

export const resolveQuantityWheelScroll = ({
  currentQuantity,
  isUserInitiated,
  itemHeight,
  maximumQuantity,
  scrollTop
}: {
  currentQuantity: string;
  isUserInitiated: boolean;
  itemHeight: number;
  maximumQuantity: number;
  scrollTop: number;
}) => {
  if (!isUserInitiated) {
    return currentQuantity;
  }

  const nextQuantity = Math.round(scrollTop / itemHeight) + minimumQuantity;
  return Math.min(maximumQuantity, Math.max(minimumQuantity, nextQuantity)).toString();
};
