import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('varchar', { name: 'product_id' })
  productId: string;

  @Column('integer')
  count: number;

  @Column('varchar', { nullable: true })
  title?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('numeric', { precision: 10, scale: 2, nullable: true })
  price?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}

