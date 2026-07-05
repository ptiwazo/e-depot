import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

class RegisterDto {
  @IsString() companyName!: string;
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() password!: string;
}

class ActivateDto {
  @IsString() token!: string;
  @IsString() password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // Auto-inscription transporteur (public).
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // Vérifie un lien d'activation (public).
  @Get('activation/:token')
  activationInfo(@Param('token') token: string) {
    return this.auth.activationInfo(token);
  }

  // Définit le mot de passe via le lien d'activation (public).
  @Post('activate')
  activate(@Body() dto: ActivateDto) {
    return this.auth.activate(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
