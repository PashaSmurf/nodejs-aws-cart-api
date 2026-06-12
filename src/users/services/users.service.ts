import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { User as UserEntity } from '../entities';
import { User } from '../models';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async findOne(name: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { username: name },
    });

    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      name: user.username,
      password: user.passwordHash,
    };
  }

  async createOne({ name, password }: User): Promise<User> {
    const id = randomUUID();

    const userEntity = new UserEntity();
    userEntity.id = id;
    userEntity.username = name;
    userEntity.passwordHash = password;

    await this.userRepository.save(userEntity);

    return { id, name, password };
  }
}
