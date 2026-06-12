import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';
import { Cart } from './cart.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryColumn('uuid', { name: 'cart_id' })
  cartId: string;

  @PrimaryColumn('varchar', { name: 'product_id' })
  productId: string;

  @Column('integer')
  count: number;

  @Column('varchar', { nullable: true })
  title?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price?: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;
}



