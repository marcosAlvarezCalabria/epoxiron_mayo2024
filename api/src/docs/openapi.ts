import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { googleLoginSchema } from "../schemas/authSchemas.js";
import { customerInputSchema, specialPieceSchema } from "../schemas/customerSchemas.js";
import {
  calculatePriceSchema,
  deliveryNoteInputSchema,
  deliveryNoteItemDraftSchema,
  deliveryNoteStatusSchema,
  sendDailyDeliveryNotesReportSchema
} from "../schemas/deliveryNoteSchemas.js";
import {
  parseVoiceAlbaranRequestSchema,
  parsedVoiceAlbaranResponseSchema
} from "../schemas/voiceSchemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const deliveryNoteStatusValues = ["DRAFT", "PENDING", "REVIEWED"] as const;
const deliveryNoteTextureValues = ["NORMAL", "MATE", "TEXTURADO", "GOFRADO"] as const;
const deliveryNotePricingModeValues = ["DIMENSIONS", "UNIT"] as const;

const dateTimeStringSchema = z.string().datetime().openapi({
  example: "2026-06-21T10:30:00.000Z"
});
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
  example: "2026-06-21"
});
const idSchema = z.string().min(1).openapi({
  example: "0d7f3b95-f00e-4e9d-a2b0-e6b78f654321"
});
const paginationSchema = registry.register(
  "Pagination",
  z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive().nullable(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean()
  })
);
const errorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    error: z.string()
  })
);
const validationErrorResponseSchema = registry.register(
  "ValidationErrorResponse",
  z.object({
    error: z.string(),
    details: z.object({
      formErrors: z.array(z.string()),
      fieldErrors: z.record(z.array(z.string()))
    })
  })
);

const specialPieceComponent = registry.register(
  "SpecialPiece",
  specialPieceSchema.extend({
    id: idSchema.optional()
  })
);
const customerInputComponent = registry.register("CustomerInput", customerInputSchema);
const customerComponent = registry.register(
  "Customer",
  customerInputSchema.extend({
    id: idSchema,
    createdAt: dateTimeStringSchema,
    updatedAt: dateTimeStringSchema
  })
);
const deliveryNoteItemDraftComponent = registry.register(
  "DeliveryNoteItemDraft",
  deliveryNoteItemDraftSchema
);
const deliveryNoteItemComponent = registry.register(
  "DeliveryNoteItem",
  z.object({
    id: idSchema.optional(),
    description: z.string().min(1),
    color: z.string().min(1),
    texture: z.enum(deliveryNoteTextureValues),
    pricingMode: z.enum(deliveryNotePricingModeValues),
    customUnitPrice: z.number().positive().nullable(),
    linearMeters: z.number().positive().nullable().optional(),
    squareMeters: z.number().positive().nullable().optional(),
    thickness: z.number().positive().nullable().optional(),
    primer: z.boolean().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    totalPrice: z.number().nonnegative()
  })
);
const deliveryNoteInputComponent = registry.register("DeliveryNoteInput", deliveryNoteInputSchema);
const deliveryNoteComponent = registry.register(
  "DeliveryNote",
  z.object({
    id: idSchema,
    number: z.string().min(1),
    customerId: idSchema,
    customerName: z.string().min(1),
    status: z.enum(deliveryNoteStatusValues),
    notes: z.string().nullable(),
    totalAmount: z.number().nonnegative(),
    date: dateTimeStringSchema,
    items: z.array(deliveryNoteItemComponent),
    createdAt: dateTimeStringSchema,
    updatedAt: dateTimeStringSchema
  })
);
const parsedVoiceAlbaranComponent = registry.register(
  "ParsedVoiceAlbaran",
  parsedVoiceAlbaranResponseSchema
);
const loginResponseSchema = registry.register(
  "GoogleLoginResponse",
  z.object({
    token: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1)
  })
);
const customersListResponseSchema = registry.register(
  "CustomersListResponse",
  z.object({
    customers: z.array(customerComponent)
  })
);
const customerResponseSchema = registry.register(
  "CustomerResponse",
  z.object({
    customer: customerComponent
  })
);
const deliveryNotesListResponseSchema = registry.register(
  "DeliveryNotesListResponse",
  z.object({
    deliveryNotes: z.array(deliveryNoteComponent),
    pagination: paginationSchema
  })
);
const deliveryNoteResponseSchema = registry.register(
  "DeliveryNoteResponse",
  z.object({
    deliveryNote: deliveryNoteComponent
  })
);
const priceCalculationResponseSchema = registry.register(
  "PriceCalculationResponse",
  z.object({
    pricing: z.object({
      unitPrice: z.number().nonnegative(),
      totalPrice: z.number().nonnegative()
    })
  })
);
const reportUploadSchema = registry.register(
  "DailyDeliveryNotesReportUpload",
  z.object({
    id: idSchema,
    reportDate: dateTimeStringSchema,
    fileId: z.string().min(1),
    fileName: z.string().min(1),
    folderName: z.string().min(1),
    notesCount: z.number().int().nonnegative(),
    webViewLink: z.string().nullable(),
    lastSourceUpdatedAt: dateTimeStringSchema,
    createdAt: dateTimeStringSchema
  })
);
const reportUploadsResponseSchema = registry.register(
  "DailyDeliveryNotesReportUploadsResponse",
  z.object({
    uploads: z.array(reportUploadSchema),
    pagination: paginationSchema
  })
);
const dashboardSummaryResponseSchema = registry.register(
  "DashboardSummaryResponse",
  z.object({
    notes: z.array(deliveryNoteComponent),
    stats: z.object({
      totalNotes: z.number().int().nonnegative(),
      totalPieces: z.number().int().nonnegative(),
      totalAmount: z.number().nonnegative(),
      reviewed: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative()
    })
  })
);
const sendDailyReportResponseSchema = registry.register(
  "SendDailyDeliveryNotesReportResponse",
  z.object({
    message: z.string(),
    result: z.object({
      date: dateTimeStringSchema,
      fileId: z.string().min(1),
      fileName: z.string().min(1),
      folderName: z.string().min(1),
      notesCount: z.number().int().nonnegative(),
      webViewLink: z.string().nullable()
    })
  })
);

const bearerOrHermesSecurity: Array<Record<string, string[]>> = [
  { bearerAuth: [] },
  { hermesSecret: [] }
];
const hermesSecretSecurity: Array<Record<string, string[]>> = [{ hermesSecret: [] }];

const commonErrorResponses = {
  400: {
    description: "Solicitud invalida",
    content: {
      "application/json": {
        schema: validationErrorResponseSchema
      }
    }
  },
  401: {
    description: "No autorizado",
    content: {
      "application/json": {
        schema: errorResponseSchema
      }
    }
  },
  500: {
    description: "Error interno del servidor",
    content: {
      "application/json": {
        schema: errorResponseSchema
      }
    }
  },
  503: {
    description: "Dependencia no disponible",
    content: {
      "application/json": {
        schema: errorResponseSchema
      }
    }
  }
} as const;

registry.registerPath({
  method: "post",
  path: "/api/auth/login/google",
  tags: ["Auth"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: googleLoginSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Login correcto",
      content: {
        "application/json": {
          schema: loginResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    500: commonErrorResponses[500]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/customers",
  tags: ["Customers"],
  security: bearerOrHermesSecurity,
  request: {
    query: z.object({
      search: z.string().optional()
    })
  },
  responses: {
    200: {
      description: "Listado de clientes",
      content: {
        "application/json": {
          schema: customersListResponseSchema
        }
      }
    },
    ...commonErrorResponses
  }
});

registry.registerPath({
  method: "get",
  path: "/api/customers/{id}",
  tags: ["Customers"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    200: {
      description: "Cliente encontrado",
      content: {
        "application/json": {
          schema: customerResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/customers",
  tags: ["Customers"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: customerInputComponent
        }
      }
    }
  },
  responses: {
    201: {
      description: "Cliente creado",
      content: {
        "application/json": {
          schema: customerResponseSchema
        }
      }
    },
    ...commonErrorResponses
  }
});

registry.registerPath({
  method: "put",
  path: "/api/customers/{id}",
  tags: ["Customers"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: customerInputComponent
        }
      }
    }
  },
  responses: {
    200: {
      description: "Cliente actualizado",
      content: {
        "application/json": {
          schema: customerResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "delete",
  path: "/api/customers/{id}",
  tags: ["Customers"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    204: {
      description: "Cliente eliminado"
    },
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

const deliveryNoteFiltersQuerySchema = z.object({
  date: dateStringSchema.optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  status: z.enum(deliveryNoteStatusValues).optional(),
  customerId: idSchema.optional(),
  today: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

registry.registerPath({
  method: "get",
  path: "/api/delivery-notes",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    query: deliveryNoteFiltersQuerySchema
  },
  responses: {
    200: {
      description: "Listado de albaranes",
      content: {
        "application/json": {
          schema: deliveryNotesListResponseSchema
        }
      }
    },
    ...commonErrorResponses
  }
});

registry.registerPath({
  method: "get",
  path: "/api/delivery-notes/report-uploads",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    query: z.object({
      dateFrom: dateStringSchema.optional(),
      dateTo: dateStringSchema.optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional()
    })
  },
  responses: {
    200: {
      description: "Listado de informes diarios subidos",
      content: {
        "application/json": {
          schema: reportUploadsResponseSchema
        }
      }
    },
    ...commonErrorResponses
  }
});

registry.registerPath({
  method: "post",
  path: "/api/delivery-notes/calculate-price",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: calculatePriceSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Precio calculado",
      content: {
        "application/json": {
          schema: priceCalculationResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/delivery-notes/send-daily-report",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: sendDailyDeliveryNotesReportSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Informe diario generado o reutilizado",
      content: {
        "application/json": {
          schema: sendDailyReportResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "No hay albaranes para la fecha solicitada",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/delivery-notes/{id}",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    200: {
      description: "Albaran encontrado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    404: {
      description: "Albaran no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/delivery-notes",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: deliveryNoteInputComponent
        }
      }
    }
  },
  responses: {
    201: {
      description: "Albaran creado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "put",
  path: "/api/delivery-notes/{id}",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: deliveryNoteInputComponent
        }
      }
    }
  },
  responses: {
    200: {
      description: "Albaran actualizado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Albaran o cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "delete",
  path: "/api/delivery-notes/{id}",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    204: {
      description: "Albaran eliminado"
    },
    401: commonErrorResponses[401],
    404: {
      description: "Albaran no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "patch",
  path: "/api/delivery-notes/{id}/status",
  tags: ["Delivery Notes"],
  security: bearerOrHermesSecurity,
  request: {
    params: z.object({
      id: idSchema
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: deliveryNoteStatusSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Estado actualizado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Albaran no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/dashboard/summary",
  tags: ["Dashboard"],
  security: bearerOrHermesSecurity,
  responses: {
    200: {
      description: "Resumen del dia",
      content: {
        "application/json": {
          schema: dashboardSummaryResponseSchema
        }
      }
    },
    ...commonErrorResponses
  }
});

registry.registerPath({
  method: "post",
  path: "/api/voice/parse-albaran",
  tags: ["Voice"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: parseVoiceAlbaranRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Transcripcion interpretada",
      content: {
        "application/json": {
          schema: parsedVoiceAlbaranComponent
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    422: {
      description: "No se pudo interpretar el texto",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/voice/parse-albaran-audio",
  tags: ["Voice"],
  security: bearerOrHermesSecurity,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            audio: z.string().openapi({
              type: "string",
              format: "binary"
            })
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Audio interpretado",
      content: {
        "application/json": {
          schema: parsedVoiceAlbaranComponent
        }
      }
    },
    400: {
      description: "No se ha recibido ningun audio o el payload es invalido",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    422: {
      description: "No se pudo interpretar el audio",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/hermes-tools/customers",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    query: z.object({
      search: z.string().optional()
    })
  },
  responses: {
    200: {
      description: "Listado de clientes",
      content: {
        "application/json": {
          schema: customersListResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/hermes-tools/customers/{id}",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    200: {
      description: "Cliente encontrado",
      content: {
        "application/json": {
          schema: customerResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/hermes-tools/delivery-notes",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    query: deliveryNoteFiltersQuerySchema
  },
  responses: {
    200: {
      description: "Listado de albaranes",
      content: {
        "application/json": {
          schema: deliveryNotesListResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/hermes-tools/delivery-notes/{id}",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    params: z.object({
      id: idSchema
    })
  },
  responses: {
    200: {
      description: "Albaran encontrado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    404: {
      description: "Albaran no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/hermes-tools/delivery-notes",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: deliveryNoteInputComponent
        }
      }
    }
  },
  responses: {
    201: {
      description: "Albaran creado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "patch",
  path: "/api/hermes-tools/delivery-notes/{id}/status",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    params: z.object({
      id: idSchema
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: deliveryNoteStatusSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Estado actualizado",
      content: {
        "application/json": {
          schema: deliveryNoteResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Albaran no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/hermes-tools/calculate-price",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: calculatePriceSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Precio calculado",
      content: {
        "application/json": {
          schema: priceCalculationResponseSchema
        }
      }
    },
    400: commonErrorResponses[400],
    401: commonErrorResponses[401],
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/json": {
          schema: errorResponseSchema
        }
      }
    },
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/hermes-tools/dashboard-summary",
  tags: ["Hermes Tools"],
  security: hermesSecretSecurity,
  responses: {
    200: {
      description: "Resumen del dia",
      content: {
        "application/json": {
          schema: dashboardSummaryResponseSchema
        }
      }
    },
    401: commonErrorResponses[401],
    500: commonErrorResponses[500],
    503: commonErrorResponses[503]
  }
});

export const buildOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Epoxiron API",
      version: "1.0.0",
      description: "Documentacion OpenAPI generada a partir de los contratos HTTP actuales."
    },
    servers: [
      {
        url: "/"
      }
    ]
  });

  document.components = {
    ...document.components,
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      hermesSecret: {
        type: "apiKey",
        in: "header",
        name: "x-hermes-secret"
      }
    }
  };

  return document;
};

void specialPieceComponent;
void deliveryNoteItemDraftComponent;
