# Guia de Instalação no webOS (LG TV Developer Mode)

## 1. Contexto do webOS e Developer Mode

O Developer Mode oficial da LG permite instalar aplicações em estágio de desenvolvimento na TV conectada à mesma rede local, sem necessidade de publicação na LG Content Store.

> [!WARNING] **Limitação Crítica Oficial do Developer Mode da LG:**
> O aplicativo Developer Mode na TV possui uma sessão com tempo limitado (geralmente entre **50 horas e 999 horas**, dependendo da conta de desenvolvedor da LG).
> - Se a sessão do Developer Mode expirar sem ser renovada no app da TV, **o webOS desinstala automaticamente os aplicativos de teste instalados via `ares-install`**.
> - Para manter o app instalado, o usuário deve periodicamente abrir o aplicativo **Developer Mode** na TV e clicar em **"Extend Session"** (ou usar renovação via script oficial `webos-dev-manager` / `ares-extend-dev`).

---

## 2. Pré-requisitos na TV LG

1. Instalar o aplicativo oficial **Developer Mode** na TV através da LG Content Store.
2. Abrir o Developer Mode na TV e realizar o login com sua conta LG Developer.
3. Ativar as seguintes opções na tela da TV:
   - **Dev Mode Status:** `ON`
   - **Key Server:** `ON`
4. Anotar os dados exibidos na tela da TV:
   - **IP Address:** (Exemplo registrado: `192.168.18.4`)
   - **Passphrase:** (Código de 6 caracteres gerado pela TV, case-sensitive)

---

## 3. Configuração do Dispositivo no Computador

O webOS CLI (`ares`) gerencia a conexão SSH segura com a TV.

### 3.1 Cadastrar a TV no `ares` (Caso ainda não esteja cadastrada)
```powershell
ares-setup-device -a lg-tv -i 192.168.18.4 -p 9922 -u prisoner
```

### 3.2 Obter a Chave SSH de Pareamento (Apenas na 1ª vez)
Com a TV ligada e a opção `Key Server: ON` no app Developer Mode da TV, execute no terminal do computador:
```powershell
ares-novacom --device lg-tv --getkey
```
O utilitário solicitará a **Passphrase** exibida na TV (ex: `B3EA28`). Após a digitação, o arquivo de chave SSH privado é baixado e associado localmente ao perfil `lg-tv`.

### 3.3 Validar a Conexão
Para testar a comunicação sem alterar nenhum aplicativo na TV:
```powershell
ares-device-info -d lg-tv
```
Se a conexão for bem-sucedida, serão exibidos o modelo real, versão do webOS e status do sistema operacional.

---

## 4. Empacotamento do Aplicativo (.IPK)

O aplicativo webOS deve conter obrigatoriamente um arquivo `appinfo.json` válido, ícone (`icon.png` 80x80) e arquivos web.

Para gerar o pacote instalável `.ipk`:
```powershell
# A partir do diretório raiz do projeto:
npm run build:tv
ares-package apps/webos-tv/dist -o dist/packages
```
Isso produzirá um arquivo com o formato:
`dist/packages/com.iptv.local_<versão>_all.ipk`

---

## 5. Instalação e Execução na TV

> [!IMPORTANT]
> Nunca execute comandos de instalação sem a confirmação explícita do usuário no chat.

### 5.1 Instalar o Aplicativo
```powershell
ares-install -d lg-tv dist/packages/com.iptv.local_1.0.0_all.ipk
```

### 5.2 Iniciar o Aplicativo
```powershell
ares-launch -d lg-tv com.iptv.local
```

### 5.3 Depuração em Tempo Real (Inspetor Web remoto)
```powershell
ares-inspect -d lg-tv -a com.iptv.local --open
```
Abre o Chrome DevTools no computador conectado diretamente ao WebKit/Chromium em execução na TV LG.

### 5.4 Desinstalar o Aplicativo
```powershell
ares-install -d lg-tv -r com.iptv.local
```
