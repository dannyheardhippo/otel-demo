export class OrderItemDto {
  productId!: number;
  qty!: number;
}

export class CreateOrderDto {
  customerId!: number;
  items!: OrderItemDto[];
  /** Deliberately handled unsafely - see collector scenario 03. */
  cardNumber!: string;
}
