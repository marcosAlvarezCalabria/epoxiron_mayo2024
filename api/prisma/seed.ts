import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedSpecialPiece {
  name: string;
  price: number;
}

interface SeedCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes: string;
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  specialPieces: SeedSpecialPiece[];
}

const customers: SeedCustomer[] = [
  {
    name: "DITRAMETAL",
    email: "administracion@ditrametal.es",
    phone: "925511414",
    address: "C/ Marmol 3 - Poligono Industrial La Torrecilla, Yeles, Toledo",
    notes:
      "Razon social: Disenos y Transformados del Metal SL\nNIF: B45653284\nWeb: www.ditrametal.es",
    pricePerLinearMeter: 1.4,
    pricePerSquareMeter: 9.5,
    minimumRate: 0.65,
    specialPieces: [
      { name: "GONDOLA KADO+CAJON+CHAPA 9005", price: 74.61 },
      { name: "GONDOLA 9005 2000X770X2+1700X450", price: 38.56 },
      { name: "GONDOLA 9005 1900X700X2+1900X1150X2", price: 64.43 },
      { name: "FRENTE CAJON 8019", price: 2.55 },
      { name: "PIEZA 9005 1030X1560+2.8MLIN", price: 19.18 },
      { name: "BANDEJA 9005 790X580", price: 4.36 },
      { name: "BANDEJA 9005 1160X580", price: 6.39 },
      { name: "CABEZA 9005 1030X920", price: 9.0 },
      { name: "BARRA Z 9016 TEXT", price: 0.7 },
      { name: "TUBO 9016 TEXT 2.2MLIN", price: 3.08 },
      { name: "BLISTER 9016 TEXT", price: 0.65 },
      { name: "COMODILLA 9016 TEXT 1160X1400", price: 15.42 },
      { name: "CAJON 9016 TEXT 850X850", price: 6.86 },
      { name: "BASTIDOR LATERAL 9005+7024 3000X1500", price: 26.72 },
      { name: "PIEZA V 9005+7024 1900X2000+1.67MLIN", price: 22.65 },
      { name: "PIEZA L 9005+7024 2500X660", price: 10.05 },
      { name: "PIEZA TUBO 1700X1670+670 9005+7024", price: 12.85 },
      { name: "JUNQUILLO 9005+7024 1.8MLIN", price: 5.04 },
      { name: "JUNQUILLO 9005+7024 2.3MLIN", price: 6.44 },
      { name: "JUNQUILLO 9005+7024 2.76MLIN", price: 7.72 },
      { name: "JUNQUILLO 9005+7024 1.51MLIN", price: 4.22 },
      { name: "JUNQUILLO 9005+7024 1.12MLIN", price: 3.13 },
      { name: "JUNQUILLO 9005+7024 1.04MLIN", price: 2.91 },
      { name: "JUNQUILLO 9005+7024 2.4MLIN", price: 6.72 },
      { name: "TRASERA 9005+7024 2480X1170", price: 22.63 },
      { name: "TRASERA 9005+7024 1880X1170", price: 18.91 },
      { name: "TRASERA 9005+7024 1240X1170", price: 14.94 },
      { name: "TUBO 9005+7024 2.74MLIN", price: 8.49 },
      { name: "TUBO 9005+7024 2.14MLIN", price: 6.63 },
      { name: "TUBO 9005+7024 1.5MLIN", price: 4.65 },
      { name: "ANGULO 9005+7024 5MLIN", price: 15.5 },
      { name: "ANGULO 9005+7024 2.6MLIN", price: 8.06 },
      { name: "ANGULO 9005+7024 2MLIN", price: 6.2 },
      { name: "ANGULO 9005+7024 1.36MLIN", price: 4.21 }
    ]
  },
  {
    name: "MOINDE",
    email: "contabilidad@moinde.es",
    phone: "915333653",
    address: "Avenida Filipinas, 52, Planta Baja, 28003, Madrid",
    notes: "Razon social: Moinde SL\nNIF: B78754678",
    pricePerLinearMeter: 1.8,
    pricePerSquareMeter: 10.5,
    minimumRate: 0.75,
    specialPieces: [
      { name: "PIE 9005", price: 13.86 },
      { name: "TABURETE VARILLA MACIZO 9005 4.6MLIN", price: 11.5 },
      { name: "SILLA 9005", price: 8.1 },
      { name: "RESPALDO SILLA 6005 950X760", price: 7.36 },
      { name: "PATA SILLA 6005 2.62MLIN", price: 4.58 },
      { name: "MAMPARA 9005 1400X1700", price: 24.99 },
      { name: "TUBO 9003 MATE 1.04MLIN", price: 2.7 },
      { name: "CRUZETA 9003 MATE", price: 1.26 },
      { name: "CHAPON 9003 MATE DIAM400", price: 4.2 },
      { name: "SILLON CHAPA 5024", price: 10.1 },
      { name: "MAMPARA JARDINERA 9005 2430X1580", price: 40.31 },
      { name: "TIRADOR ORO+ENV+ESMER 0.5MLIN", price: 2.7 },
      { name: "TIRADOR ORO+ENV+ESMER 0.33MLIN", price: 1.79 },
      { name: "CRUZETA 9005 700X700", price: 2.52 },
      { name: "PIE CHAPON 400X400+300X300+VIGA 700X300 ESMERILADO", price: 16.96 }
    ]
  },
  {
    name: "SGF",
    email: "dgangoso@sgf.es",
    phone: "925484619",
    address: "Calle de Basalto, Yeles, 45220, Toledo",
    notes:
      "Razon social: Soluciones Globales de Fabricacion SL\nNIF: B84325711\nWeb: www.sgf.es",
    pricePerLinearMeter: 1.8,
    pricePerSquareMeter: 10.5,
    minimumRate: 0.75,
    specialPieces: [
      { name: "CONJUNTO VERDE MILITAR PIEZAS", price: 1.5 },
      { name: "TUBO 9005 0.92MLIN", price: 1.66 },
      { name: "TUBO 9005 0.58MLIN", price: 1.04 },
      { name: "CASQUILLO 9005", price: 0.75 },
      { name: "CHAPA 9005 110X120", price: 0.75 },
      { name: "CHAPA 9005 280X100", price: 0.75 },
      { name: "CHAPA 9005 300X200", price: 0.75 },
      { name: "ARMARIO 7035 TEXT 13.72MLIN", price: 24.73 },
      { name: "PERFIL 7035 TEXT 1.87MLIN", price: 3.36 },
      { name: "PERFIL 7035 TEXT 1.75MLIN", price: 3.15 },
      { name: "SSD260323-38 9005 TEXT", price: 10.36 },
      { name: "SSD260323-238 9005 TEXT", price: 10.36 },
      { name: "SSD200828-181 9005 TEXT", price: 18.22 },
      { name: "SSD200828-363 9005 TEXT", price: 9.11 },
      { name: "SSD200828-364 9005 TEXT", price: 9.11 },
      { name: "SSD200828-191 9005 TEXT", price: 4.37 },
      { name: "SSD200828-377 9005 TEXT", price: 3.41 },
      { name: "SSD200828-30 9005 TEXT", price: 3.82 },
      { name: "SSD260323-05 9005 TEXT", price: 9.33 },
      { name: "SSD260323-02 9005 TEXT", price: 9.24 },
      { name: "SSD260323-102 9005 TEXT", price: 9.24 },
      { name: "SSD260422-38 9005 TEXT", price: 10.5 },
      { name: "SSD260422-238 9005 TEXT", price: 10.5 },
      { name: "SSD260422-181 9005 TEXT", price: 16.5 },
      { name: "SSD260422-363 9005 TEXT", price: 8.27 },
      { name: "SSD260422-364 9005 TEXT", price: 8.27 },
      { name: "SSD260422-191 9005 TEXT", price: 3.95 },
      { name: "SSD260422-377 9005 TEXT", price: 3.1 },
      { name: "SSD260422-30 9005 TEXT", price: 3.47 },
      { name: "SSD260422-05 9005 TEXT", price: 10.15 },
      { name: "SSD260422-02 9005 TEXT", price: 9.6 },
      { name: "SSD260422-102 9005 TEXT", price: 9.6 },
      { name: "SSD200828-390 9005 TEXT", price: 1.87 },
      { name: "SSD200828-07 9005 TEXT", price: 0.4 },
      { name: "SSD200828-392 9005 TEXT", price: 0.7 },
      { name: "SSD260422-60 9005 TEXT", price: 0.6 },
      { name: "SSD260422-62 9005 TEXT", price: 0.6 },
      { name: "SSD200828-411 9005 TEXT", price: 0.76 },
      { name: "SSD200828-412 9005 TEXT", price: 0.83 },
      { name: "SSD200828-413 9005 TEXT", price: 0.87 },
      { name: "PANEL RANU 4U 9005 TEXT", price: 0.98 },
      { name: "CONJ OREJET 9005 TEXT", price: 1.5 },
      { name: "CHAPA 7001 GOF", price: 2.77 },
      { name: "CHAPA 7001 GOF 530X770", price: 4.28 },
      { name: "CHAPA 7001 GOF 200X250", price: 0.75 },
      { name: "PUERTA 7016 TEXT", price: 9.42 },
      { name: "BASTIDOR 2000X600X600MM 21\" 46U RAL 7016 MICROTEXT", price: 51.43 },
      { name: "ARMARIO 7016 TEXT 600X600X600", price: 26.3 },
      { name: "CAJA ELEMENTOS 7016 TEXT", price: 2.73 },
      { name: "PUERTA 7016 TEXT 1200", price: 6.3 },
      { name: "ARMARIO 7016 TEXT 1340X600X600", price: 42.0 },
      { name: "BASTIDOR 7016 TEXT 4.48MLIN", price: 8.06 },
      { name: "PLETINA 7016 TEXT 1.1MLIN", price: 1.98 },
      { name: "U 7016 TEXT 0.6MLIN", price: 1.08 },
      { name: "PERFIL 9005 1890X90", price: 3.4 },
      { name: "CHAPA 9005 90X30", price: 0.6 },
      { name: "PERFIL 9003 2090X90", price: 3.76 },
      { name: "CHAPA 9003 90X30", price: 0.6 },
      { name: "ARMARIO 7032 GOF 221X32X23", price: 27.91 },
      { name: "ARMARIO 7032 GOF 950X620X250", price: 20.03 },
      { name: "ARMARIO 7032 GOF 80X54X19", price: 17.74 },
      { name: "ARMARIO 7032 GOF 65X52X25", price: 14.58 },
      { name: "ARMARIO 7032 GOF 1550X1680", price: 27.34 },
      { name: "PUERTA 7032 GOF 600X540", price: 3.4 },
      { name: "CHAPA 7032 GOF 400X200", price: 0.84 },
      { name: "CHAPA 7032 GOF 210X70", price: 0.75 },
      { name: "BASE 7032 GOF 480X570X190", price: 4.18 },
      { name: "ARMARIO 7032 GOF 1720X800+640X500X2+500X190", price: 22.15 },
      { name: "BANDEJA 7035 GOF 570X260", price: 1.56 },
      { name: "CHAPA 7035 GOF 440X240", price: 1.1 },
      { name: "CHAPA 7035 GOF 200X45", price: 0.75 },
      { name: "CHAPA 7035 GOF 45X40", price: 0.75 },
      { name: "CHAPA 7035 GOF 130X40", price: 0.75 }
    ]
  },
  {
    name: "ROTULOS LA SAGRA",
    address: "Calle Timanfaya 15, 28905, Getafe, Madrid",
    notes: "Razon social: Rotulos La Sagra SL\nNIF: B19450428",
    pricePerLinearMeter: 1.8,
    pricePerSquareMeter: 10.5,
    minimumRate: 0.75,
    specialPieces: [
      { name: "LETRA 9005", price: 0.9 },
      { name: "LETRA 7030", price: 0.9 },
      { name: "LETRA 9010", price: 0.9 },
      { name: "CASQUILLO 9005", price: 0.9 },
      { name: "CASQUILLO 7030", price: 0.9 },
      { name: "CASQUILLO 9010", price: 0.9 },
      { name: "ARBOL 9010", price: 2.55 },
      { name: "ARBOL 7030", price: 2.55 },
      { name: "ARBOL 9005", price: 2.55 }
    ]
  }
];

const syncCustomer = async (customer: SeedCustomer) => {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      name: customer.name
    },
    select: {
      id: true
    }
  });

  if (existingCustomer) {
    await prisma.$transaction([
      prisma.specialPiece.deleteMany({
        where: {
          customerId: existingCustomer.id
        }
      }),
      prisma.customer.update({
        where: {
          id: existingCustomer.id
        },
        data: {
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          address: customer.address ?? null,
          notes: customer.notes,
          pricePerLinearMeter: customer.pricePerLinearMeter,
          pricePerSquareMeter: customer.pricePerSquareMeter,
          minimumRate: customer.minimumRate,
          specialPieces: {
            create: customer.specialPieces
          }
        }
      })
    ]);

    return "updated";
  }

  await prisma.customer.create({
    data: {
      name: customer.name,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
      notes: customer.notes,
      pricePerLinearMeter: customer.pricePerLinearMeter,
      pricePerSquareMeter: customer.pricePerSquareMeter,
      minimumRate: customer.minimumRate,
      specialPieces: {
        create: customer.specialPieces
      }
    }
  });

  return "created";
};

async function main() {
  let created = 0;
  let updated = 0;

  for (const customer of customers) {
    const result = await syncCustomer(customer);
    if (result === "created") {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    `Seed completado: ${created} clientes creados, ${updated} clientes actualizados.`
  );
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
