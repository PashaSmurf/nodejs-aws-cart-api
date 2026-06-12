import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Cart as CartEntity, CartStatus, CartItem as CartItemEntity } from '../entities';
import { Cart, CartStatuses, CartItem as CartItemModel } from '../models';
import { PutCartPayload } from 'src/order/type';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private cartRepository: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private cartItemRepository: Repository<CartItemEntity>,
  ) {}

  async findByUserId(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['items'],
    });

    if (!cart) {
      return null;
    }

    return this.mapCartEntityToModel(cart);
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const id = randomUUID();
    const timestamp = new Date();

    const cart = this.cartRepository.create({
      id,
      userId: user_id,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: CartStatus.OPEN,
      items: [],
    });

    await this.cartRepository.save(cart);

    return this.mapCartEntityToModel(cart);
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return this.createByUserId(userId);
  }

    async updateByUserId(
      userId: string,
      payload: PutCartPayload,
    ): Promise<Cart> {
      const userCart = await this.findOrCreateByUserId(userId);
      const cart = await this.cartRepository.findOne({
        where: { id: userCart.id },
        relations: ['items'],
      });

      if (!cart) {
        throw new Error('Cart not found');
      }

      // Find product in items
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId === payload.product.id,
      );

      if (existingItemIndex === -1) {
        // Create new item using CartItem repository
        const newItem = this.cartItemRepository.create({
          cartId: cart.id,
          productId: payload.product.id,
          count: payload.count,
          title: payload.product.title,
          description: payload.product.description,
          price: payload.product.price,
        });
        await this.cartItemRepository.save(newItem);
      } else if (payload.count === 0) {
        // Remove item using the CartItem repository
        await this.cartItemRepository.delete({
          cartId: cart.id,
          productId: payload.product.id,
        });
      } else {
        // Update count and product details
        await this.cartItemRepository.update(
          {
            cartId: cart.id,
            productId: payload.product.id,
          },
          {
            count: payload.count,
            title: payload.product.title,
            description: payload.product.description,
            price: payload.product.price,
          },
        );
      }

      // Update cart timestamp using query builder to avoid cascade issues
      await this.cartRepository
        .createQueryBuilder()
        .update()
        .set({ updatedAt: new Date() })
        .where({ id: cart.id })
        .execute();

      return this.findByUserId(userId);
    }

  async removeByUserId(userId: string): Promise<void> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
    });

    if (cart) {
      // Delete all cart items for this cart
      await this.cartRepository.manager.delete('cart_items', {
        cartId: cart.id
      });

      // Then mark cart as ORDERED
      cart.status = CartStatus.ORDERED;
      cart.updatedAt = new Date();
      await this.cartRepository.save(cart);
    }
  }

    private mapCartEntityToModel(cart: CartEntity): Cart {
      return {
        id: cart.id,
        user_id: cart.userId,
        created_at: cart.createdAt.getTime(),
        updated_at: cart.updatedAt.getTime(),
        status: cart.status === CartStatus.OPEN ? CartStatuses.OPEN : CartStatuses.ORDERED,
        items: cart.items
          ? cart.items.map(
              (item) =>
                ({
                  product: {
                    id: item.productId,
                    title: item.title || '',
                    description: item.description || '',
                    price: item.price ? Number(item.price) : 0,
                  },
                  count: item.count,
                } as CartItemModel),
            )
          : [],
      };
    }
}
