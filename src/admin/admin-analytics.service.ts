import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { Review } from '../reviews/entities/review.entity';
import { ToolStatus } from '../tools/enums/tool-status.enum';
import { AvailabilityStatus } from '../tools/enums/availability-status.enum';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
  ) {}

  private getDateRange(period: string) {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }
    
    return { start, end: now };
  }

  async getRevenueAnalytics(period: string, granularity: string) {
    console.log('🔍 [DATABASE] Fetching revenue analytics from database...');
    const { start, end } = this.getDateRange(period);
    
    let dateFormat: string;
    let groupByFormat: string;
    
    switch (granularity) {
      case 'week':
        dateFormat = "DATE_FORMAT(pt.createdAt, '%Y-%u')"; // Year-Week
        groupByFormat = "YEAR(pt.createdAt), WEEK(pt.createdAt)";
        break;
      case 'month':
        dateFormat = "DATE_FORMAT(pt.createdAt, '%Y-%m')"; // Year-Month
        groupByFormat = "YEAR(pt.createdAt), MONTH(pt.createdAt)";
        break;
      default:
        dateFormat = "DATE(pt.createdAt)";
        groupByFormat = "DATE(pt.createdAt)";
    }
    
    const revenueData = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .select(dateFormat, 'period')
      .addSelect('SUM(pt.amount)', 'revenue')
      .addSelect('COUNT(*)', 'transactions')
      .addSelect('AVG(pt.amount)', 'averageTransaction')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy(groupByFormat)
      .orderBy('pt.createdAt', 'ASC')
      .getRawMany();
    
    const totalRevenue = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .select('SUM(pt.amount)', 'total')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();
    
    const result = {
      chartData: revenueData.map(item => ({
        period: item.period,
        revenue: parseFloat(item.revenue || '0'),
        transactions: parseInt(item.transactions || '0'),
        averageTransaction: parseFloat(item.averageTransaction || '0'),
      })),
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
      period,
      granularity,
    };
    
    console.log('✅ [DATABASE] Revenue analytics fetched:', {
      chartDataCount: result.chartData.length,
      totalRevenue: result.totalRevenue,
      source: 'DATABASE'
    });
    
    return result;
  }

  async getUserAnalytics(period: string) {
    console.log('🔍 [DATABASE] Fetching user analytics from database...');
    const { start, end } = this.getDateRange(period);
    
    const [userGrowth, userActivity, userSegmentation] = await Promise.all([
      this.getUserGrowthData(start, end),
      this.getUserActivityData(start, end),
      this.getUserSegmentationData(),
    ]);
    
    const result = {
      userGrowth,
      userActivity,
      userSegmentation,
      period,
    };
    
    console.log('✅ [DATABASE] User analytics fetched:', {
      userGrowthCount: result.userGrowth.length,
      userActivityCount: result.userActivity.length,
      userSegmentationCount: result.userSegmentation.length,
      source: 'DATABASE'
    });
    
    return result;
  }

  private async getUserGrowthData(start: Date, end: Date) {
    const data = await this.userRepository
      .createQueryBuilder('user')
      .select('DATE(user.createdAt)', 'date')
      .addSelect('COUNT(*)', 'newUsers')
      .where('user.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(user.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    return data.map(item => ({
      date: item.date,
      newUsers: parseInt(item.newUsers || '0'),
    }));
  }

  private async getUserActivityData(start: Date, end: Date) {
    const data = await this.userRepository
      .createQueryBuilder('user')
      .select('DATE(user.lastLoginAt)', 'date')
      .addSelect('COUNT(*)', 'activeUsers')
      .where('user.lastLoginAt BETWEEN :start AND :end', { start, end })
      .andWhere('user.lastLoginAt IS NOT NULL')
      .groupBy('DATE(user.lastLoginAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    return data.map(item => ({
      date: item.date,
      activeUsers: parseInt(item.activeUsers || '0'),
    }));
  }

  private async getUserSegmentationData() {
    const data = await this.userRepository
      .createQueryBuilder('user')
      .select('CASE WHEN user.isAdmin = 1 THEN "admin" ELSE "user" END', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.isAdmin')
      .getRawMany();
    
    return data.map(item => ({
      role: item.role,
      count: parseInt(item.count || '0'),
    }));
  }

  async getToolAnalytics(period: string) {
    console.log('🔍 [DATABASE] Fetching tool analytics from database...');
    const { start, end } = this.getDateRange(period);
    
    const [topTools, categoryPerformance, toolRatings] = await Promise.all([
      this.getTopToolsData(start, end),
      this.getCategoryPerformanceData(start, end),
      this.getToolRatingsData(),
    ]);
    
    const result = {
      topTools,
      categoryPerformance,
      toolRatings,
      period,
    };
    
    console.log('✅ [DATABASE] Tool analytics fetched:', {
      topToolsCount: result.topTools.length,
      categoryPerformanceCount: result.categoryPerformance.length,
      toolRatingsCount: result.toolRatings.length,
      source: 'DATABASE'
    });
    
    return result;
  }

  private async getTopToolsData(start: Date, end: Date) {
    const data = await this.toolRepository
      .createQueryBuilder('tool')
      .leftJoin('tool.bookings', 'booking')
      .select('tool.id', 'id')
      .addSelect('tool.title', 'title')
      .addSelect('COUNT(booking.id)', 'bookings')
      .addSelect('SUM(booking.totalPrice)', 'revenue')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('tool.id')
      .orderBy('COUNT(booking.id)', 'DESC')
      .limit(10)
      .getRawMany();
    
    return data.map(item => ({
      id: parseInt(item.id || '0'),
      title: item.title || 'Unknown Tool',
      bookings: parseInt(item.bookings || '0'),
      revenue: parseFloat(item.revenue || '0'),
    }));
  }

  private async getCategoryPerformanceData(start: Date, end: Date) {
    const data = await this.toolRepository
      .createQueryBuilder('tool')
      .leftJoin('tool.category', 'category')
      .leftJoin('tool.bookings', 'booking')
      .select('category.name', 'category')
      .addSelect('COUNT(booking.id)', 'bookings')
      .addSelect('SUM(booking.totalPrice)', 'revenue')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('category.name IS NOT NULL')
      .groupBy('category.id')
      .orderBy('COUNT(booking.id)', 'DESC')
      .getRawMany();
    
    return data.map(item => ({
      category: item.category || 'Unknown Category',
      bookings: parseInt(item.bookings || '0'),
      revenue: parseFloat(item.revenue || '0'),
    }));
  }

  private async getToolRatingsData() {
    const data = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.tool', 'tool')
      .select('tool.title', 'toolTitle')
      .addSelect('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('tool.title IS NOT NULL')
      .groupBy('tool.id')
      .orderBy('AVG(review.rating)', 'DESC')
      .limit(10)
      .getRawMany();
    
    return data.map(item => ({
      toolTitle: item.toolTitle || 'Unknown Tool',
      averageRating: parseFloat(item.averageRating || '0'),
      reviewCount: parseInt(item.reviewCount || '0'),
    }));
  }

  async getBookingAnalytics(period: string) {
    console.log('🔍 [DATABASE] Fetching booking analytics from database...');
    const { start, end } = this.getDateRange(period);
    
    const [bookingTrends, statusDistribution, averageBookingValue] = await Promise.all([
      this.getBookingTrendsData(start, end),
      this.getBookingStatusDistribution(start, end),
      this.getAverageBookingValue(start, end),
    ]);
    
    const result = {
      bookingTrends,
      statusDistribution,
      averageBookingValue,
      period,
    };
    
    console.log('✅ [DATABASE] Booking analytics fetched:', {
      bookingTrendsCount: result.bookingTrends.length,
      statusDistributionCount: result.statusDistribution.length,
      averageBookingValue: result.averageBookingValue.average,
      source: 'DATABASE'
    });
    
    return result;
  }

  private async getBookingTrendsData(start: Date, end: Date) {
    const data = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('DATE(booking.createdAt)', 'date')
      .addSelect('COUNT(*)', 'bookings')
      .addSelect('SUM(booking.totalPrice)', 'revenue')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(booking.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    return data.map(item => ({
      date: item.date,
      bookings: parseInt(item.bookings || '0'),
      revenue: parseFloat(item.revenue || '0'),
    }));
  }

  private async getBookingStatusDistribution(start: Date, end: Date) {
    const data = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('booking.status')
      .getRawMany();
    
    return data.map(item => ({
      status: item.status || 'unknown',
      count: parseInt(item.count || '0'),
    }));
  }

  private async getAverageBookingValue(start: Date, end: Date) {
    const data = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('AVG(booking.totalPrice)', 'average')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();
    
    return {
      average: parseFloat(data?.average || '0'),
    };
  }

  async getGeographicAnalytics() {
    console.log('🔍 [DATABASE] Fetching geographic analytics from database...');
    
    // Get users by country
    const usersByCountry = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.country', 'country')
      .select('country.name', 'country')
      .addSelect('COUNT(user.id)', 'users')
      .where('country.name IS NOT NULL')
      .groupBy('country.id')
      .orderBy('COUNT(user.id)', 'DESC')
      .limit(10)
      .getRawMany();
    
    // Get revenue by country
    const revenueByCountry = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .leftJoin('pt.user', 'user')
      .leftJoin('user.country', 'country')
      .select('country.name', 'country')
      .addSelect('SUM(pt.amount)', 'revenue')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('country.name IS NOT NULL')
      .groupBy('country.id')
      .orderBy('SUM(pt.amount)', 'DESC')
      .limit(10)
      .getRawMany();
    
    const result = {
      usersByCountry: usersByCountry.map(item => ({
        country: item.country,
        users: parseInt(item.users || '0'),
      })),
      revenueByCountry: revenueByCountry.map(item => ({
        country: item.country,
        revenue: parseFloat(item.revenue || '0'),
      })),
    };
    
    console.log('✅ [DATABASE] Geographic analytics fetched:', {
      usersByCountryCount: result.usersByCountry.length,
      revenueByCountryCount: result.revenueByCountry.length,
      source: 'DATABASE'
    });
    
    return result;
  }

  async getPerformanceMetrics(period: string) {
    console.log('🔍 [DATABASE] Fetching performance metrics from database...');
    const { start, end } = this.getDateRange(period);
    
    const [conversionRate, averageSessionDuration, bounceRate] = await Promise.all([
      this.calculateConversionRate(start, end),
      this.calculateAverageSessionDuration(start, end),
      this.calculateBounceRate(start, end),
    ]);
    
    const result = {
      conversionRate,
      averageSessionDuration,
      bounceRate,
      period,
    };
    
    console.log('✅ [DATABASE] Performance metrics fetched:', {
      conversionRate: result.conversionRate,
      averageSessionDuration: result.averageSessionDuration,
      bounceRate: result.bounceRate,
      source: 'DATABASE'
    });
    
    return result;
  }

  private async calculateConversionRate(start: Date, end: Date) {
    const totalUsers = await this.userRepository.count({
      where: { createdAt: Between(start, end) },
    });
    
    const usersWithBookings = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.bookings', 'booking')
      .where('user.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('booking.id IS NOT NULL')
      .getCount();
    
    return totalUsers > 0 ? (usersWithBookings / totalUsers) * 100 : 0;
  }

  private async calculateAverageSessionDuration(start: Date, end: Date) {
    // This would require session tracking implementation
    // For now, return 0 since we don't have session data
    return 0;
  }

  private async calculateBounceRate(start: Date, end: Date) {
    // This would require page view tracking implementation
    // For now, return 0 since we don't have page view data
    return 0;
  }

  async exportAnalytics(type: string, period: string, format: string) {
    console.log(`🔍 [DATABASE] Exporting ${type} analytics from database...`);
    
    let data: any;
    
    switch (type) {
      case 'revenue':
        data = await this.getRevenueAnalytics(period, 'day');
        break;
      case 'users':
        data = await this.getUserAnalytics(period);
        break;
      case 'tools':
        data = await this.getToolAnalytics(period);
        break;
      case 'bookings':
        data = await this.getBookingAnalytics(period);
        break;
      default:
        throw new Error('Invalid export type');
    }
    
    const result = {
      data,
      format,
      exportedAt: new Date(),
    };
    
    console.log('✅ [DATABASE] Analytics exported:', {
      type,
      format,
      source: 'DATABASE'
    });
    
    return result;
  }

  // Add new method to format data for frontend
  async getFormattedAnalyticsData(period: string = '30d') {
    console.log('🔍 [DATABASE] Fetching formatted analytics data from database...');
    
    try {
      // Fetch all required data in parallel
      const [revenueData, userData, toolData, bookingData] = await Promise.all([
        this.getRevenueAnalytics(period, 'day'),
        this.getUserAnalytics(period),
        this.getToolAnalytics(period),
        this.getBookingAnalytics(period)
      ]);

      // Calculate KPIs
      const { start, end } = this.getDateRange(period);
      
      // Get current period stats
      const [totalUsers, totalBookings, totalTools, currentRevenue] = await Promise.all([
        this.userRepository.count(),
        this.bookingRepository.count({ where: { createdAt: Between(start, end) } }),
        this.toolRepository.count({ 
          where: { 
            toolStatus: ToolStatus.PUBLISHED,
            availabilityStatus: AvailabilityStatus.AVAILABLE
          } 
        }),
        this.paymentTransactionRepository
          .createQueryBuilder('pt')
          .select('SUM(pt.amount)', 'total')
          .where('pt.status = :status', { status: 'completed' })
          .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
          .getRawOne()
      ]);

      // Calculate growth rates
      const periodDiff = end.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - periodDiff);
      const previousEnd = new Date(start);

      const [previousUsers, previousBookings, previousRevenue] = await Promise.all([
        this.userRepository.count({ where: { createdAt: Between(previousStart, previousEnd) } }),
        this.bookingRepository.count({ where: { createdAt: Between(previousStart, previousEnd) } }),
        this.paymentTransactionRepository
          .createQueryBuilder('pt')
          .select('SUM(pt.amount)', 'total')
          .where('pt.status = :status', { status: 'completed' })
          .andWhere('pt.createdAt BETWEEN :start AND :end', { start: previousStart, end: previousEnd })
          .getRawOne()
      ]);

      const currentUserCount = await this.userRepository.count({ where: { createdAt: Between(start, end) } });
      const currentRevenueValue = parseFloat(currentRevenue?.total || '0');
      const previousRevenueValue = parseFloat(previousRevenue?.total || '0');

      // Calculate growth percentages
      const userGrowth = previousUsers > 0 ? ((currentUserCount - previousUsers) / previousUsers) * 100 : 0;
      const revenueGrowth = previousRevenueValue > 0 ? ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 : 0;
      const bookingGrowth = previousBookings > 0 ? ((totalBookings - previousBookings) / previousBookings) * 100 : 0;
      const toolGrowth = 5; // Mock value since we don't track tool creation dates

      // Format the response to match frontend expectations
      const formattedData = {
        kpis: {
          total_revenue: currentRevenueValue,
          revenue_growth: Math.round(revenueGrowth * 100) / 100,
          active_users: totalUsers,
          user_growth: Math.round(userGrowth * 100) / 100,
          total_bookings: totalBookings,
          booking_growth: Math.round(bookingGrowth * 100) / 100,
          active_tools: totalTools,
          tool_growth: toolGrowth
        },
        charts: {
          revenue: (revenueData.chartData || []).map((item: any) => ({
            date: item.period,
            revenue: item.revenue,
            transactions: item.transactions
          })),
          categories: (toolData.categoryPerformance || []).map((item: any) => {
            const totalBookings = toolData.categoryPerformance.reduce((sum: number, cat: any) => sum + (cat.bookings || 0), 0);
            return {
              category: item.category,
              count: item.bookings || 0,
              percentage: totalBookings > 0 ? Math.round(((item.bookings || 0) / totalBookings) * 100 * 100) / 100 : 0
            };
          }),
          user_growth: (userData.userGrowth || []).map((item: any) => {
            // Calculate cumulative total users
            const cumulativeUsers = userData.userGrowth
              .filter((u: any) => u.date <= item.date)
              .reduce((sum: number, u: any) => sum + (u.newUsers || 0), 0);
            
            return {
              date: item.date,
              newUsers: item.newUsers || 0,
              totalUsers: cumulativeUsers
            };
          }),
          top_tools: (toolData.topTools || []).map((item: any) => ({
            id: item.id?.toString() || '0',
            title: item.title || 'Unknown Tool',
            bookings: item.bookings || 0,
            revenue: item.revenue || 0
          }))
        }
      };

      console.log('✅ [DATABASE] Formatted analytics data:', {
        kpis: formattedData.kpis,
        chartCounts: {
          revenue: formattedData.charts.revenue.length,
          categories: formattedData.charts.categories.length,
          userGrowth: formattedData.charts.user_growth.length,
          topTools: formattedData.charts.top_tools.length
        },
        source: 'DATABASE'
      });

      return formattedData;
    } catch (error) {
      console.error('❌ [DATABASE] Error fetching formatted analytics data:', error);
      throw error;
    }
  }
}