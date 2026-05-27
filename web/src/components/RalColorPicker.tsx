import { MagnifyingGlassIcon, SwatchIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

interface RalOption {
  code: string;
  name: string;
  hex: string;
}

interface RalFamily {
  family: string;
  options: RalOption[];
}

const family = (label: string, hex: string, entries: Array<[string, string]>): RalFamily => ({
  family: label,
  options: entries.map(([code, name]) => ({ code, name, hex }))
});

const ralFamilies: RalFamily[] = [
  family("Amarillos", "#D4A017", [
    ["RAL 1000", "Green beige"],
    ["RAL 1001", "Beige"],
    ["RAL 1002", "Sand yellow"],
    ["RAL 1003", "Signal yellow"],
    ["RAL 1004", "Golden yellow"],
    ["RAL 1005", "Honey yellow"],
    ["RAL 1006", "Maize yellow"],
    ["RAL 1007", "Daffodil yellow"],
    ["RAL 1011", "Brown beige"],
    ["RAL 1012", "Lemon yellow"],
    ["RAL 1013", "Oyster white"],
    ["RAL 1014", "Ivory"],
    ["RAL 1015", "Light ivory"],
    ["RAL 1016", "Sulfur yellow"],
    ["RAL 1017", "Saffron yellow"],
    ["RAL 1018", "Zinc yellow"],
    ["RAL 1019", "Grey beige"],
    ["RAL 1020", "Olive yellow"],
    ["RAL 1021", "Rape yellow"],
    ["RAL 1023", "Traffic yellow"],
    ["RAL 1024", "Ochre yellow"],
    ["RAL 1026", "Luminous yellow"],
    ["RAL 1027", "Curry"],
    ["RAL 1028", "Melon yellow"],
    ["RAL 1032", "Broom yellow"],
    ["RAL 1033", "Dahlia yellow"],
    ["RAL 1034", "Pastel yellow"],
    ["RAL 1035", "Pearl beige"],
    ["RAL 1036", "Pearl gold"],
    ["RAL 1037", "Sun yellow"]
  ]),
  family("Naranjas", "#D9681F", [
    ["RAL 2000", "Yellow orange"],
    ["RAL 2001", "Red orange"],
    ["RAL 2002", "Vermilion"],
    ["RAL 2003", "Pastel orange"],
    ["RAL 2004", "Pure orange"],
    ["RAL 2005", "Luminous orange"],
    ["RAL 2007", "Lum. bright orange"],
    ["RAL 2008", "Bright red orange"],
    ["RAL 2009", "Traffic orange"],
    ["RAL 2010", "Signal orange"],
    ["RAL 2011", "Deep orange"],
    ["RAL 2012", "Salmon orange"],
    ["RAL 2013", "Pearl orange"]
  ]),
  family("Rojos", "#A3362A", [
    ["RAL 3000", "Flame red"],
    ["RAL 3001", "Signal red"],
    ["RAL 3002", "Carmine red"],
    ["RAL 3003", "Ruby red"],
    ["RAL 3004", "Purple red"],
    ["RAL 3005", "Wine red"],
    ["RAL 3007", "Black red"],
    ["RAL 3009", "Oxide red"],
    ["RAL 3011", "Brown red"],
    ["RAL 3012", "Beige red"],
    ["RAL 3013", "Tomato red"],
    ["RAL 3014", "Antique pink"],
    ["RAL 3015", "Light pink"],
    ["RAL 3016", "Coral red"],
    ["RAL 3017", "Rose"],
    ["RAL 3018", "Strawberry red"],
    ["RAL 3020", "Traffic red"],
    ["RAL 3022", "Salmon pink"],
    ["RAL 3024", "Luminous red"],
    ["RAL 3026", "Luminous red"],
    ["RAL 3027", "Raspberry red"],
    ["RAL 3028", "Pure red"],
    ["RAL 3031", "Orient red"],
    ["RAL 3032", "Pearl ruby red"],
    ["RAL 3033", "Pearl pink"]
  ]),
  family("Violetas", "#7A4B8E", [
    ["RAL 4001", "Red lilac"],
    ["RAL 4002", "Red violet"],
    ["RAL 4003", "Heather violet"],
    ["RAL 4004", "Claret violet"],
    ["RAL 4005", "Blue lilac"],
    ["RAL 4006", "Traffic purple"],
    ["RAL 4007", "Purple violet"],
    ["RAL 4008", "Signal violet"],
    ["RAL 4009", "Pastel violet"],
    ["RAL 4010", "Telemagenta"],
    ["RAL 4011", "Pearl violet"],
    ["RAL 4012", "Pearl black berry"]
  ]),
  family("Azules", "#2B5C88", [
    ["RAL 5000", "Violet blue"],
    ["RAL 5001", "Green blue"],
    ["RAL 5002", "Ultramarine blue"],
    ["RAL 5003", "Saphire blue"],
    ["RAL 5004", "Black blue"],
    ["RAL 5005", "Signal blue"],
    ["RAL 5007", "Brillant blue"],
    ["RAL 5008", "Grey blue"],
    ["RAL 5009", "Azure blue"],
    ["RAL 5010", "Gentian blue"],
    ["RAL 5011", "Steel blue"],
    ["RAL 5012", "Light blue"],
    ["RAL 5013", "Cobalt blue"],
    ["RAL 5014", "Pigeon blue"],
    ["RAL 5015", "Sky blue"],
    ["RAL 5017", "Traffic blue"],
    ["RAL 5018", "Turquoise blue"],
    ["RAL 5019", "Capri blue"],
    ["RAL 5020", "Ocean blue"],
    ["RAL 5021", "Water blue"],
    ["RAL 5022", "Night blue"],
    ["RAL 5023", "Distant blue"],
    ["RAL 5024", "Pastel blue"],
    ["RAL 5025", "Pearl gentian blue"],
    ["RAL 5026", "Pearl night blue"]
  ]),
  family("Verdes", "#2F5D3B", [
    ["RAL 6000", "Patina green"],
    ["RAL 6001", "Emerald green"],
    ["RAL 6002", "Leaf green"],
    ["RAL 6003", "Olive green"],
    ["RAL 6004", "Blue green"],
    ["RAL 6005", "Moss green"],
    ["RAL 6006", "Grey olive"],
    ["RAL 6007", "Bottle green"],
    ["RAL 6008", "Brown green"],
    ["RAL 6009", "Fir green"],
    ["RAL 6010", "Grass green"],
    ["RAL 6011", "Reseda green"],
    ["RAL 6012", "Black green"],
    ["RAL 6013", "Reed green"],
    ["RAL 6014", "Yellow olive"],
    ["RAL 6015", "Black olive"],
    ["RAL 6016", "Turquoise green"],
    ["RAL 6017", "May green"],
    ["RAL 6018", "Yellow green"],
    ["RAL 6019", "Pastel green"],
    ["RAL 6020", "Chrome green"],
    ["RAL 6021", "Pale green"],
    ["RAL 6022", "Olive drab"],
    ["RAL 6024", "Traffic green"],
    ["RAL 6025", "Fern green"],
    ["RAL 6026", "Opal green"],
    ["RAL 6027", "Light green"],
    ["RAL 6028", "Pine green"],
    ["RAL 6029", "Mint green"],
    ["RAL 6032", "Signal green"],
    ["RAL 6033", "Mint turquoise"],
    ["RAL 6034", "Pastel turquoise"],
    ["RAL 6035", "Pearl green"],
    ["RAL 6036", "Pearl opal green"],
    ["RAL 6037", "Pure green"],
    ["RAL 6038", "Luminous green"]
  ]),
  family("Grises", "#72787F", [
    ["RAL 7000", "Squirrel grey"],
    ["RAL 7001", "Silver grey"],
    ["RAL 7002", "Olive grey"],
    ["RAL 7003", "Moss grey"],
    ["RAL 7004", "Signal grey"],
    ["RAL 7005", "Mouse grey"],
    ["RAL 7006", "Beige grey"],
    ["RAL 7008", "Khaki grey"],
    ["RAL 7009", "Green grey"],
    ["RAL 7010", "Tarpaulin grey"],
    ["RAL 7011", "Iron grey"],
    ["RAL 7012", "Basalt grey"],
    ["RAL 7013", "Brown grey"],
    ["RAL 7015", "Slate grey"],
    ["RAL 7016", "Anthracite grey"],
    ["RAL 7021", "Black grey"],
    ["RAL 7022", "Umbra grey"],
    ["RAL 7023", "Concrete grey"],
    ["RAL 7024", "Graphite grey"],
    ["RAL 7026", "Granite grey"],
    ["RAL 7030", "Stone grey"],
    ["RAL 7031", "Blue grey"],
    ["RAL 7032", "Pebble grey"],
    ["RAL 7033", "Cement grey"],
    ["RAL 7034", "Yellow grey"],
    ["RAL 7035", "Light grey"],
    ["RAL 7036", "Platinum grey"],
    ["RAL 7037", "Dusty grey"],
    ["RAL 7038", "Agate grey"],
    ["RAL 7039", "Quartz grey"],
    ["RAL 7040", "Window grey"],
    ["RAL 7042", "Traffic grey A"],
    ["RAL 7043", "Traffic grey B"],
    ["RAL 7044", "Silk grey"],
    ["RAL 7045", "Telegrey 1"],
    ["RAL 7046", "Telegrey 2"],
    ["RAL 7047", "Telegrey 4"],
    ["RAL 7048", "Pearl mouse grey"]
  ]),
  family("Marrones", "#5A3E2B", [
    ["RAL 8000", "Green brown"],
    ["RAL 8001", "Ochre brown"],
    ["RAL 8002", "Signal brown"],
    ["RAL 8003", "Clay brown"],
    ["RAL 8004", "Copper brown"],
    ["RAL 8007", "Fawn brown"],
    ["RAL 8008", "Olive brown"],
    ["RAL 8011", "Nut brown"],
    ["RAL 8012", "Red brown"],
    ["RAL 8014", "Sepia brown"],
    ["RAL 8015", "Chestnut brown"],
    ["RAL 8016", "Mahogany brown"],
    ["RAL 8017", "Chocolate brown"],
    ["RAL 8019", "Grey brown"],
    ["RAL 8022", "Black brown"],
    ["RAL 8023", "Orange brown"],
    ["RAL 8024", "Beige brown"],
    ["RAL 8025", "Pale brown"],
    ["RAL 8028", "Terra brown"],
    ["RAL 8029", "Pearl copper"]
  ]),
  family("Blancos y negros", "#D8D8D8", [
    ["RAL 9001", "Cream"],
    ["RAL 9002", "Grey white"],
    ["RAL 9003", "Signal white"],
    ["RAL 9004", "Signal black"],
    ["RAL 9005", "Jet black"],
    ["RAL 9006", "White aluminium"],
    ["RAL 9007", "Grey aluminium"],
    ["RAL 9010", "Pure white"],
    ["RAL 9011", "Graphite black"],
    ["RAL 9016", "Traffic white"],
    ["RAL 9017", "Traffic black"],
    ["RAL 9018", "Papyrus white"],
    ["RAL 9022", "Pearl light grey"],
    ["RAL 9023", "Pearl dark grey"]
  ])
];

const allOptions = ralFamilies.flatMap((group) => group.options);

const getOptionByCode = (value: string) => allOptions.find((option) => option.code === value) ?? null;

interface RalColorPickerProps {
  onChange: (value: string) => void;
  value: string;
}

export const RalColorPicker = ({ onChange, value }: RalColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = getOptionByCode(value);

  const filteredFamilies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return ralFamilies;
    }

    return ralFamilies
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          `${option.code} ${option.name}`.toLowerCase().includes(query)
        )
      }))
      .filter((group) => group.options.length > 0);
  }, [search]);

  return (
    <>
      <button
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gray-950/60 px-3 py-2 text-left text-sm text-white"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 border border-white/10"
            style={{ backgroundColor: selectedOption?.hex ?? "#111827" }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {selectedOption ? `${selectedOption.code} - ${selectedOption.name}` : value}
            </p>
            <p className="text-[11px] leading-tight text-gray-500">Seleccionar color RAL</p>
          </div>
        </div>
        <SwatchIcon className="h-4 w-4 shrink-0 text-cyan-300" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm">
          <button
            aria-label="Cerrar selector RAL"
            className="absolute inset-0"
            onClick={() => {
              setIsOpen(false);
              setSearch("");
            }}
            type="button"
          />
          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col bg-[#0b1220] sm:inset-8 sm:rounded-2xl sm:border sm:border-white/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="text-lg font-bold text-white">Colores RAL</p>
                <p className="text-sm text-gray-400">Selecciona un acabado habitual</p>
              </div>
              <button
                className="rounded-2xl border border-white/10 px-3 py-1 text-sm text-gray-300"
                onClick={() => {
                  setIsOpen(false);
                  setSearch("");
                }}
                type="button"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-500" />
                <input
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar RAL o nombre"
                  value={search}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              {filteredFamilies.map((group) => (
                <section className="space-y-1.5" key={group.family}>
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    {group.family}
                  </h4>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {group.options.map((option) => (
                      <button
                        className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-colors ${
                          value === option.code
                            ? "border-cyan-500/40 bg-cyan-500/10"
                            : "border-white/10 bg-gray-950/50 hover:border-white/20"
                        }`}
                        key={option.code}
                        onClick={() => {
                          onChange(option.code);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        type="button"
                      >
                        <span
                          className="h-4 w-4 shrink-0 border border-white/10"
                          style={{ backgroundColor: option.hex }}
                        />
                        <p className="truncate text-xs font-medium leading-tight text-white">
                          {option.code} - {option.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
