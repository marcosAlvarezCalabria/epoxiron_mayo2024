import type { Request, Response } from "express";
import type {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  GetCustomersUseCase,
  UpdateCustomerUseCase
} from "../application/use-cases/customers.js";
import { getRouteParam } from "./requestParsers.js";

export class CustomersController {
  public constructor(
    private readonly getCustomersUseCase: GetCustomersUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase
  ) {}

  public list = async (request: Request, response: Response) => {
    const search = typeof request.query.search === "string" ? request.query.search : undefined;
    const customers = await this.getCustomersUseCase.execute(search);
    response.json({ customers });
  };

  public getById = async (request: Request, response: Response) => {
    const customer = await this.getCustomerUseCase.execute(getRouteParam(request.params.id));
    response.json({ customer });
  };

  public create = async (request: Request, response: Response) => {
    const customer = await this.createCustomerUseCase.execute(request.body);
    response.status(201).json({ customer });
  };

  public update = async (request: Request, response: Response) => {
    const customer = await this.updateCustomerUseCase.execute(getRouteParam(request.params.id), request.body);
    response.json({ customer });
  };

  public delete = async (request: Request, response: Response) => {
    await this.deleteCustomerUseCase.execute(getRouteParam(request.params.id));
    response.status(204).send();
  };
}
