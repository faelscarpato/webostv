# IPTV Local Player & Manager para TV LG webOS

Sistema completo e privado para gerenciamento e reprodução de playlists IPTV autorizadas na rede local para Smart TVs LG rodando webOS, com painel web para celular/computador e serviço backend local.

---

## 📌 Visão Geral

- **100% Local e Privado:** Sem envio de dados para servidores externos, nuvem, telemetria ou analytics.
- **Player webOS de Alta Performance:** Desenvolvido especialmente para TV LG, operado 100% pelo controle remoto físico (D-Pad / Magic Remote) com foco claro e navegação de 10 pés.
- **Painel de Controle Responsivo:** Gerencie sua lista M3U, organize canais, marque favoritos e associe EPG pelo smartphone ou computador.
- **Segurança Avançada:** Pareamento TV ↔ Servidor por PIN temporário revogável, proteção rigorosa contra SSRF na importação de URLs e sanitização de credenciais em logs.
- **Preservação da Fonte:** As edições, favoritos e renomeações nunca sobrescrevem ou corrompem o arquivo M3U original.

---

## 📁 Estrutura do Projeto

```text
├── apps/
│   ├── local-server/      # Backend Node.js/TypeScript (API REST, Pareamento, Anti-SSRF)
│   ├── manager/           # Painel Web responsivo (Vite + React + Tailwind)
│   └── webos-tv/          # App webOS para a TV LG (10-foot UI, Spatial Navigation, HLS)
├── packages/
│   └── shared/            # Schemas de dados, tipos TypeScript e Parsers (M3U / XMLTV)
├── docs/                  # Documentação completa de arquitetura, segurança e instalação
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── INSTALL-WEBOS.md
│   └── DECISIONS.md
├── tests/                 # Testes unitários e de integração
├── AGENTS.md              # Diretrizes de engenharia e regras de desenvolvimento
└── README.md              # Este arquivo
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** >= 20 (Testado com Node.js 24)
- **webOS CLI (`ares`)** instalado (para empacotamento e instalação na TV)
- TV LG conectada na mesma rede local (Wi-Fi ou cabo) com o aplicativo **Developer Mode** ativo.

### 1. Instalação das Dependências
Na raiz do projeto:
```bash
npm install
```

### 2. Iniciar o Servidor Local e o Painel Web
```bash
npm run dev
```
- **Painel Web (Manager):** `http://localhost:3000` (ou `http://<IP-DO-PC>:3000` no celular)
- **Serviço Local (API):** `http://localhost:3001`

---

## 📺 Instalação na TV LG

Consulte o guia completo passo a passo em [docs/INSTALL-WEBOS.md](docs/INSTALL-WEBOS.md).

Resumo:
```bash
# 1. Compilar o app da TV e empacotar no formato .ipk
npm run package:tv

# 2. Instalar na TV (requer confirmação explícita)
ares-install -d lg-tv dist/packages/com.iptv.local_1.0.0_all.ipk

# 3. Lançar o aplicativo na TV
ares-launch -d lg-tv com.iptv.local
```

---

## 🔒 Diretrizes de Uso Responsável

Este projeto é uma ferramenta de reprodução técnica para mídias privadas e transmissões autorizadas do próprio usuário. Não forneça listas públicas protegidas por direitos autorais, não compartilhe credenciais e utilize apenas transmissões legítimas às quais possua direito de acesso.
