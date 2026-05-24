export class DomainException extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DomainException";
    this.statusCode = statusCode;
  }
}

