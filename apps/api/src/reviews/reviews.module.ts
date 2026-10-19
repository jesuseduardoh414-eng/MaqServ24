import { Module } from '@nestjs/common';
import { ServiceReviewsController } from './service-reviews.controller';

/** Reseñas de servicio: el cliente califica desde el enlace del correo de cierre. */
@Module({ controllers: [ServiceReviewsController] })
export class ReviewsModule {}
