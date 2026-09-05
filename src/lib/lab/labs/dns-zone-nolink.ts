import type { Lab } from "../types";

export const lab: Lab = {
    id: "dns-zone-nolink",
    code: "INC-2207",
    title: "Private Endpoint do SQL resolve no IP público",
    difficulty: "n2",
    technologies: ["dns", "private-ip", "vnet"],
    severity: "Sev2",
    etaMin: 15,
    ticket: {
      title: "sql-prod.database.windows.net não usa o Private Endpoint",
      reporter: "Marina Costa · Data",
      service: "rg-data / pep-sql-prod",
      openedAt: "2026-09-01T14:02:00-03:00",
      description:
        "Private Endpoint 10.8.0.12 foi criado para o Azure SQL. A zona privatelink.database.windows.net tem o A record. A VM vm-app-api ainda resolve o FQDN para o IP público e o firewall do SQL recusa.",
      symptoms: [
        "nslookup sql-prod.database.windows.net a partir de vm-app-api retorna 40.x público",
        "A record sql-prod na zona privada aponta 10.8.0.12",
        "Public network access no SQL está disabled",
      ],
      impact: "API não abre conexão com o banco. Checkout parado.",
      lastChange: "Private Endpoint criado; VNet link ficou fora do módulo Terraform.",
    },
    topology: {
      nodes: [
        { id: "vnet", kind: "vnet", label: "vnet-app  10.4.0.0/16", x: 8, y: 22, w: 50, h: 62 },
        { id: "snet", kind: "subnet", label: "snet-app", sublabel: "10.4.2.0/24", x: 14, y: 36, w: 38, h: 24, parentId: "vnet" },
        { id: "vm", kind: "vm", label: "vm-app-api", sublabel: "10.4.2.9", x: 30, y: 48, status: "warn", parentId: "snet" },
        { id: "spe", kind: "subnet", label: "snet-pep", sublabel: "10.4.8.0/24", x: 14, y: 64, w: 38, h: 16, parentId: "vnet" },
        { id: "sql", kind: "sql", label: "pep-sql-prod", sublabel: "10.8.0.12", x: 30, y: 70, status: "ok", parentId: "spe" },
        { id: "dns", kind: "dns", label: "privatelink.database.windows.net", sublabel: "sem VNet link", x: 70, y: 44, status: "error" },
      ],
      edges: [
        { from: "vm", to: "dns", kind: "blocked", label: "sem link" },
        { from: "dns", to: "sql", kind: "dashed", label: "A 10.8.0.12" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0006-4e11-9c01-dns",
      resourceGroup: "rg-data",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-app",
          space: ["10.4.0.0/16"],
          subnets: [
            { name: "snet-app", prefix: "10.4.2.0/24" },
            { name: "snet-pep", prefix: "10.4.8.0/24" },
          ],
        },
      ],
      nsgs: [],
      routeTables: [],
      vms: [
        {
          name: "vm-app-api",
          os: "linux",
          vnet: "vnet-app",
          subnet: "snet-app",
          privateIp: "10.4.2.9",
          nic: "nic-app-api",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [
        {
          name: "privatelink.database.windows.net",
          records: [{ name: "sql-prod", type: "A", value: "10.8.0.12" }],
          links: [],
        },
      ],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-app-api", to: "sql-prod.database.windows.net", proto: "dns", result: "ok", note: "resolve público 40.78.12.44" },
      { from: "vm-app-api", to: "sql-prod.privatelink.database.windows.net", proto: "dns", result: "nxdomain" },
      { from: "vm-app-api", to: "10.8.0.12", proto: "tcp", port: 1433, result: "ok" },
      { from: "vm-app-api", to: "40.78.12.44", proto: "tcp", port: 1433, result: "reject", note: "public access disabled" },
    ],
    hypotheses: [
      { id: "a", label: "O A record da zona privada está errado", correct: false },
      { id: "b", label: "NSG da snet-pep bloqueia 1433", correct: false },
      { id: "c", label: "A zona privada existe mas não está linked à vnet-app", correct: true },
      { id: "d", label: "A VM usa DNS on-prem sem conditional forwarder e isso é esperado", correct: false },
    ],
    hints: [
      "Se o IP 10.8.0.12:1433 funciona mas o FQDN não, o problema é resolução, não o Private Endpoint.",
      "Liste a zona e em seguida os virtual network links. Compare com a VNet da VM.",
      "privatelink.database.windows.net não tem nenhum link. A VM consulta o DNS Azure default e cai no CNAME público.",
    ],
    debrief: {
      rootCause:
        "A zona privatelink.database.windows.net contém o A correto, porém não há virtual network link para vnet-app. Sem link, o resolvedor da VNet ignora a zona e segue o CNAME público.",
      solution:
        "Crie o link: az network private-dns link vnet create ... --virtual-network vnet-app --registration-enabled false. Valide nslookup retornando 10.8.0.12.",
      commands: [
        "nslookup sql-prod.database.windows.net",
        "az network private-dns zone list -g rg-data -o table",
        "az network private-dns link vnet list -g rg-data -z privatelink.database.windows.net -o table",
      ],
      conceptTitle: "Private DNS link",
      concept:
        "Private Endpoint não altera o DNS sozinho. A zona privatelink.* precisa estar ligada à VNet (ou a um DNS resolver central). Sem link, o cliente resolve o endpoint público.",
      prevention:
        "Módulo de Private Endpoint deve criar zona + record + vnet link (e links em spokes via hub DNS). Teste de aceite: nslookup do FQDN == IP do PEP.",
    },
  };
