import {
  Controller,
  Get,
  Delete,
  Put,
  Body,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { BasicAuthGuard } from '../auth';
import { Order, OrderService } from '../order';
import { AppRequest, getUserIdFromRequest } from '../shared';
import { calculateCartTotal } from './models-rules';
import { CartService } from './services';
import { CartItem } from './models';
import { CreateOrderDto, PutCartPayload } from 'src/order/type';
import { DataSource } from 'typeorm';

@Controller('api/profile/cart')
export class CartController {
  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private dataSource: DataSource,
  ) {}

  @UseGuards(BasicAuthGuard)
  @Get()
  async findUserCart(@Req() req: AppRequest): Promise<CartItem[]> {
    const cart = await this.cartService.findOrCreateByUserId(
      getUserIdFromRequest(req),
    );

    return cart.items;
  }

  @UseGuards(BasicAuthGuard)
  @Put()
  async updateUserCart(
    @Req() req: AppRequest,
    @Body() body: PutCartPayload,
  ): Promise<CartItem[]> {
    const cart = await this.cartService.updateByUserId(
      getUserIdFromRequest(req),
      body,
    );

    return cart.items;
  }

  @UseGuards(BasicAuthGuard)
  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearUserCart(@Req() req: AppRequest): Promise<void> {
    await this.cartService.removeByUserId(getUserIdFromRequest(req));
  }

  @UseGuards(BasicAuthGuard)
  @Put('order')
  async checkout(
    @Req() req: AppRequest,
    @Body() body: CreateOrderDto,
  ): Promise<{ order: Order }> {
    const userId = getUserIdFromRequest(req);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cart = await this.cartService.findByUserId(userId);

      if (!(cart && cart.items.length)) {
        throw new BadRequestException('Cart is empty');
      }

      const { id: cartId, items } = cart;
      const total = calculateCartTotal(items);
      const order = await this.orderService.create({
        userId,
        cartId,
        items: items.map(({ product, count }) => ({
          productId: product.id,
          count,
          title: product.title,
          description: product.description,
          price: product.price,
        })),
        address: body.address,
        total,
      });

      // Mark cart as ORDERED (using queryRunner for transaction)
      await queryRunner.manager.update(
        'carts',
        { id: cartId },
        { status: 'ORDERED' },
      );

      // Delete cart items (using queryRunner for transaction)
      await queryRunner.manager.delete('cart_items', { cartId: cartId });

      await queryRunner.commitTransaction();

      return {
        order,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  @UseGuards(BasicAuthGuard)
  @Get('order')
  async getOrder(): Promise<Order[]> {
    return this.orderService.getAll();
  }
}
