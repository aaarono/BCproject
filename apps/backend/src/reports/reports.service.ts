import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTargetExists(targetType: CreateReportDto['targetType'], targetId: string) {
    switch (targetType) {
      case 'LISTING': {
        const exists = await this.prisma.listing.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Listing not found');
        return;
      }
      case 'USER': {
        const exists = await this.prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('User not found');
        return;
      }
      case 'REVIEW': {
        const exists = await this.prisma.review.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Review not found');
        return;
      }
      case 'DEAL': {
        const exists = await this.prisma.deal.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Deal not found');
        return;
      }
      case 'MESSAGE': {
        const exists = await this.prisma.message.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Message not found');
        return;
      }
      default:
        throw new BadRequestException('Unsupported report target type');
    }
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    const targetId = dto.targetId.trim();
    const reason = dto.reason.trim();
    const details = dto.details?.trim();

    await this.assertTargetExists(dto.targetType, targetId);

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId,
        reason,
        details: details && details.length > 0 ? details : null,
      },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async listMyReports(reporterId: string) {
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        adminNote: true,
        reviewedAt: true,
        createdAt: true,
      },
    });
  }
}
