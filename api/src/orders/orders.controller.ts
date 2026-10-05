import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get()
  findAll(@Query('customerId', ParseIntPipe) customerId: number) {
    return this.orders.findAllForCustomer(customerId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orders.findOne(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
