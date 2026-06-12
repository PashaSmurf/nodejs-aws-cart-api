import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Order as OrderEntity, OrderStatus, OrderItem as OrderItemEntity } from '../entities';
import { Order as OrderModel } from '../models';
import { OrderStatus as OrderStatusType } from '../type';
import { CreateOrderPayload } from '../type';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemRepository: Repository<OrderItemEntity>,
  ) {}

  async getAll(): Promise<OrderModel[]> {
    const orders = await this.orderRepository.find({
      relations: ['items'],
    });
    return orders.map((order) => this.mapOrderEntityToModel(order));
  }

  async findById(orderId: string): Promise<OrderModel> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    return order ? this.mapOrderEntityToModel(order) : null;
  }

  async create(data: CreateOrderPayload): Promise<OrderModel> {
    const id = randomUUID() as string;

    const orderEntity = new OrderEntity();
    orderEntity.id = id;
    orderEntity.userId = data.userId;
    orderEntity.cartId = data.cartId;
    orderEntity.payment = data.address;
    orderEntity.delivery = data.address;
    orderEntity.comments = '';
    orderEntity.status = OrderStatus.OPEN;
    orderEntity.total = data.total;

    // Save order first
    await this.orderRepository.save(orderEntity);

    // Create and save order items
    const orderItems = data.items.map((item) => {
      const orderItem = new OrderItemEntity();
      orderItem.id = randomUUID();
      orderItem.orderId = id;
      orderItem.productId = item.productId;
      orderItem.count = item.count;
      orderItem.title = item.title || '';
      orderItem.description = item.description || '';
      orderItem.price = item.price ? Number(item.price) : 0;
      return orderItem;
    });

    if (orderItems.length > 0) {
      await this.orderItemRepository.save(orderItems);
    }

    // Reload order with items
    const savedOrder = await this.findById(id);
    return savedOrder;
  }

  async update(orderId: string, data: OrderEntity): Promise<void> {
    const order = await this.findById(orderId);

    if (!order) {
      throw new Error('Order does not exist.');
    }

    await this.orderRepository.update(orderId, {
      ...data,
      id: orderId,
    });
  }

  private mapOrderEntityToModel(orderEntity: OrderEntity): OrderModel {
    return {
      id: orderEntity.id,
      userId: orderEntity.userId,
      items: orderEntity.items
        ? orderEntity.items.map((item) => ({
            productId: item.productId,
            count: item.count,
          }))
        : [],
      cartId: orderEntity.cartId,
      address: {
        address: orderEntity.delivery?.address || '',
        firstName: orderEntity.delivery?.firstName || '',
        lastName: orderEntity.delivery?.lastName || '',
        comment: orderEntity.comments || '',
      },
      statusHistory: [
        {
          comment: '',
          status: OrderStatusType.Open,
          timestamp: orderEntity.createdAt.getTime(),
        },
      ],
    };
  }
}
