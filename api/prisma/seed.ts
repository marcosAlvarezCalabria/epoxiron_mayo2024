import "dotenv/config";
import { PrismaClient, type DeliveryNoteStatus } from "@prisma/client";

const prisma = new PrismaClient();

const customers = [
  {
    name: "Industrias Aretxaga",
    email: "compras@aretxaga.es",
    phone: "+34 944 120 301",
    address: "Pol. Ind. Ugaldeguren I, Parcela 12, Zamudio",
    notes: "Cliente industrial recurrente. Prioriza acabados anticorrosion.",
    pricePerLinearMeter: 12.5,
    pricePerSquareMeter: 28,
    minimumRate: 45,
    grosorPrecio: 6,
    specialPieces: [
      { name: "Barandilla estandar", price: 48 },
      { name: "Marco reforzado", price: 62 }
    ]
  },
  {
    name: "Metalurgica Rias Baixas",
    email: "oficina@metriasbaixas.com",
    phone: "+34 986 503 118",
    address: "Rua da Ponte 18, Mos, Pontevedra",
    notes: "Suelen trabajar colores RAL oscuros y series medias.",
    pricePerLinearMeter: 11,
    pricePerSquareMeter: 24.5,
    minimumRate: 38,
    grosorPrecio: 4.5,
    specialPieces: [
      { name: "Perfil U 80", price: 21 },
      { name: "Soporte lateral", price: 16 }
    ]
  },
  {
    name: "Estructuras Levante 2000",
    email: "admin@levante2000.es",
    phone: "+34 961 772 450",
    address: "Cami Vell de Xirivella 44, Valencia",
    notes: "Pide entregas rapidas y revision visual antes de salida.",
    pricePerLinearMeter: 13.2,
    pricePerSquareMeter: 30,
    minimumRate: 50,
    grosorPrecio: 7,
    specialPieces: [
      { name: "Bastidor industrial", price: 95 },
      { name: "Rejilla tecnica", price: 34 }
    ]
  },
  {
    name: "Talleres Sierra Norte",
    email: "pedidos@sierranorte.net",
    phone: "+34 918 444 902",
    address: "Av. del Encinar 7, Colmenar Viejo, Madrid",
    notes: "Mucho volumen en piezas pequenas con tarifa minima.",
    pricePerLinearMeter: 9.8,
    pricePerSquareMeter: 22,
    minimumRate: 32,
    grosorPrecio: 3.5,
    specialPieces: [
      { name: "Tapa lateral", price: 9.5 },
      { name: "Pletina corta", price: 7.5 }
    ]
  },
  {
    name: "Carpinteria Metalica Costa Sur",
    email: "info@costasurmetal.com",
    phone: "+34 956 811 223",
    address: "Ctra. Sanlucar km 3, Jerez de la Frontera",
    notes: "Cliente de exteriores. Suele pedir suplementos por grosor.",
    pricePerLinearMeter: 14,
    pricePerSquareMeter: 31.5,
    minimumRate: 52,
    grosorPrecio: 8,
    specialPieces: [
      { name: "Puerta peatonal", price: 110 },
      { name: "Poste reforzado", price: 42 }
    ]
  },
  {
    name: "Montajes del Cantabrico",
    email: "produccion@montajescantabrico.es",
    phone: "+34 942 204 117",
    address: "Barrio Raos, Nave 5, Santander",
    notes: "Trabajan lotes medianos para obra y mantenimiento.",
    pricePerLinearMeter: 10.7,
    pricePerSquareMeter: 25.8,
    minimumRate: 36,
    grosorPrecio: 5.2,
    specialPieces: [
      { name: "Bandeja portacables", price: 18 },
      { name: "Soporte tubular", price: 14 }
    ]
  },
  {
    name: "Inox Aragon Tecnica",
    email: "logistica@inoxaragon.es",
    phone: "+34 976 588 771",
    address: "Poligono Malpica, Calle F Oeste 23, Zaragoza",
    notes: "Exigen trazabilidad por lote y acabados consistentes.",
    pricePerLinearMeter: 15.5,
    pricePerSquareMeter: 33,
    minimumRate: 58,
    grosorPrecio: 8.5,
    specialPieces: [
      { name: "Bastidor inoxidable", price: 125 },
      { name: "Cubre motor", price: 54 }
    ]
  },
  {
    name: "Soluciones Ferroviarias del Sur",
    email: "proyectos@sfsur.es",
    phone: "+34 954 667 810",
    address: "Parque Empresarial La Isla, Dos Hermanas, Sevilla",
    notes: "Piezas tecnicas con bastante documentacion y control visual.",
    pricePerLinearMeter: 16.2,
    pricePerSquareMeter: 35,
    minimumRate: 60,
    grosorPrecio: 9,
    specialPieces: [
      { name: "Caja tecnica", price: 88 },
      { name: "Soporte de cabina", price: 73 }
    ]
  }
] as const;

const colors = ["RAL 7016", "RAL 9005", "RAL 9010", "RAL 6005", "RAL 3009", "RAL 5008"] as const;
const genericDescriptions = [
  "Perfil rectangular",
  "Marco soldado",
  "Soporte tecnico",
  "Rejilla exterior",
  "Pletina mecanizada",
  "Bastidor auxiliar",
  "Caja de registro",
  "Puerta metalica"
] as const;

type SeedCustomer = (typeof customers)[number];

const round = (value: number) => Math.round(value * 100) / 100;

const randomFrom = <T>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)]!;

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number) =>
  round(Math.random() * (max - min) + min);

const calculateItemPrice = (
  customer: SeedCustomer,
  item: {
    description: string;
    linearMeters?: number | null;
    squareMeters?: number | null;
    thickness?: number | null;
    quantity: number;
  }
) => {
  const specialPiece = customer.specialPieces.find(
    (piece) => piece.name.toLowerCase() === item.description.toLowerCase()
  );

  let totalPrice = 0;

  if (specialPiece) {
    totalPrice = specialPiece.price * item.quantity;
  } else if (item.linearMeters) {
    totalPrice = item.linearMeters * customer.pricePerLinearMeter * item.quantity;
  } else if (item.squareMeters) {
    totalPrice = item.squareMeters * customer.pricePerSquareMeter * item.quantity;
  }

  const minimum = customer.minimumRate * item.quantity;
  if (totalPrice < minimum) {
    totalPrice = minimum;
  }

  if (item.thickness && customer.grosorPrecio) {
    totalPrice += customer.grosorPrecio * item.quantity;
  }

  totalPrice = round(totalPrice);

  return {
    unitPrice: round(totalPrice / item.quantity),
    totalPrice
  };
};

const buildRandomItem = (customer: SeedCustomer) => {
  const useSpecialPiece = Math.random() < 0.35;
  const quantity = randomInt(1, 6);
  const color = randomFrom(colors);

  if (useSpecialPiece) {
    const piece = randomFrom(customer.specialPieces);
    const pricing = calculateItemPrice(customer, {
      description: piece.name,
      quantity
    });

    return {
      description: piece.name,
      color,
      linearMeters: null,
      squareMeters: null,
      thickness: null,
      quantity,
      ...pricing
    };
  }

  const useLinearMeters = Math.random() < 0.55;
  const thickness = Math.random() < 0.6 ? randomFloat(1.5, 5.5) : null;
  const linearMeters = useLinearMeters ? randomFloat(0.8, 4.5) : null;
  const squareMeters = useLinearMeters ? null : randomFloat(0.7, 3.8);
  const description = randomFrom(genericDescriptions);
  const pricing = calculateItemPrice(customer, {
    description,
    linearMeters,
    squareMeters,
    thickness,
    quantity
  });

  return {
    description,
    color,
    linearMeters,
    squareMeters,
    thickness,
    quantity,
    ...pricing
  };
};

const buildRandomDate = () => {
  const now = new Date();
  const daysAgo = randomInt(0, 45);
  const date = new Date(now);
  date.setDate(now.getDate() - daysAgo);
  date.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0);
  return date;
};

async function main() {
  await prisma.deliveryNoteItem.deleteMany();
  await prisma.specialPiece.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.customer.deleteMany();

  const createdCustomers = [];

  for (const customer of customers) {
    const createdCustomer = await prisma.customer.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        pricePerLinearMeter: customer.pricePerLinearMeter,
        pricePerSquareMeter: customer.pricePerSquareMeter,
        minimumRate: customer.minimumRate,
        grosorPrecio: customer.grosorPrecio,
        specialPieces: {
          create: customer.specialPieces.map((piece) => ({
            name: piece.name,
            price: piece.price
          }))
        }
      },
      include: {
        specialPieces: true
      }
    });

    createdCustomers.push(createdCustomer);
  }

  const year = new Date().getFullYear();
  let sequence = 1;

  for (const customer of createdCustomers) {
    const notesToCreate = randomInt(2, 5);

    for (let index = 0; index < notesToCreate; index += 1) {
      const date = buildRandomDate();
      const statusOptions: DeliveryNoteStatus[] = ["DRAFT", "PENDING", "REVIEWED"];
      const status = randomFrom(statusOptions);
      const itemCount = randomInt(1, 4);
      const items = Array.from({ length: itemCount }, () => buildRandomItem(customer));
      const totalAmount = round(items.reduce((sum, item) => sum + item.totalPrice, 0));
      const number = `ALB-${year}-${sequence.toString().padStart(4, "0")}`;

      await prisma.deliveryNote.create({
        data: {
          number,
          customerId: customer.id,
          customerName: customer.name,
          status,
          notes:
            status === "REVIEWED"
              ? "Trabajo revisado y listo para salida."
              : status === "PENDING"
                ? "Pendiente de validacion final."
                : "Borrador generado desde seed.",
          totalAmount,
          date,
          items: {
            create: items
          }
        }
      });

      sequence += 1;
    }
  }

  const totalNotes = sequence - 1;
  console.log(`Seed completado: ${createdCustomers.length} clientes y ${totalNotes} albaranes creados.`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
