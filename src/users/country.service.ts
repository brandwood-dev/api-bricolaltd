import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountryService {
  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
  ) {}

  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    // Check if country with same ID or code already exists
    const existingCountry = await this.countryRepository.findOne({
      where: [{ id: createCountryDto.id }, { code: createCountryDto.code }],
    });

    if (existingCountry) {
      throw new ConflictException(
        'Country with this ID or code already exists',
      );
    }

    const country = this.countryRepository.create(createCountryDto);
    return await this.countryRepository.save(country);
  }

  async findAll(): Promise<Country[]> {
    return await this.countryRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findActive(): Promise<Country[]> {
    return await this.countryRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findByContinent(continent: string): Promise<Country[]> {
    return await this.countryRepository.find({
      where: { continent, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { id },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    return country;
  }

  async findByCode(code: string): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { code },
    });

    if (!country) {
      throw new NotFoundException(`Country with code ${code} not found`);
    }

    return country;
  }

  async update(
    id: string,
    updateCountryDto: UpdateCountryDto,
  ): Promise<Country> {
    const country = await this.findOne(id);

    // Check for conflicts if updating code
    if (updateCountryDto.code && updateCountryDto.code !== country.code) {
      const existingCountry = await this.countryRepository.findOne({
        where: { code: updateCountryDto.code },
      });
      if (existingCountry) {
        throw new ConflictException('Country with this code already exists');
      }
    }

    Object.assign(country, updateCountryDto);
    return await this.countryRepository.save(country);
  }

  async remove(id: string): Promise<void> {
    const country = await this.findOne(id);
    await this.countryRepository.remove(country);
  }

  async activate(id: string): Promise<Country> {
    const country = await this.findOne(id);
    country.isActive = true;
    return await this.countryRepository.save(country);
  }

  async deactivate(id: string): Promise<Country> {
    const country = await this.findOne(id);
    country.isActive = false;
    return await this.countryRepository.save(country);
  }

  async getCurrencies(): Promise<{ currency: string; countries: string[] }[]> {
    const countries = await this.findActive();
    const currencyMap = new Map<string, string[]>();

    countries.forEach((country) => {
      if (!currencyMap.has(country.currency)) {
        currencyMap.set(country.currency, []);
      }
      currencyMap.get(country.currency)!.push(country.name);
    });

    return Array.from(currencyMap.entries()).map(
      ([currency, countryNames]) => ({
        currency,
        countries: countryNames,
      }),
    );
  }

  async getPhonePrefixes(): Promise<
    { phonePrefix: string; countries: string[] }[]
  > {
    const countries = await this.findActive();
    const prefixMap = new Map<string, string[]>();

    countries.forEach((country) => {
      if (!prefixMap.has(country.phonePrefix)) {
        prefixMap.set(country.phonePrefix, []);
      }
      prefixMap.get(country.phonePrefix)!.push(country.name);
    });

    return Array.from(prefixMap.entries()).map(
      ([phonePrefix, countryNames]) => ({
        phonePrefix,
        countries: countryNames,
      }),
    );
  }
}
