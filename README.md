# Times Up!

Mobilní párty hra s kartami — česká verze klasické hry Times Up!

## Soubory

| Soubor       | Popis                          |
|--------------|--------------------------------|
| `index.html` | Hlavní stránka                 |
| `style.css`  | Styly a animace                |
| `app.js`     | Herní logika                   |
| `cards.txt`  | Seznam karet (jedna na řádek)  |

## Lokální spuštění

```bash
python3 -m http.server 8080
```

Otevřete [http://localhost:8080](http://localhost:8080).

## Nasazení na Cloudflare Pages (z GitHubu)

Toto je čistě statický web — **není potřeba žádný build**.

### 1. Nahrajte na GitHub

```bash
git init
git add .
git commit -m "Initial commit: Times Up card game"
git branch -M main
git remote add origin https://github.com/VASE_UZIVATELSKE_JMENO/timesup.git
git push -u origin main
```

### 2. Připojte repozitář v Cloudflare

1. Přihlaste se do [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Vyberte GitHub a autorizujte přístup
4. Vyberte repozitář `timesup`

### 3. Nastavení buildu

| Pole                    | Hodnota        |
|-------------------------|----------------|
| Framework preset        | **None**       |
| Build command           | *(prázdné)*    |
| Build output directory  | `.`            |
| Root directory          | *(prázdné)*    |

Klikněte **Save and Deploy**. Cloudflare nasadí soubory z kořene repozitáře.

### 4. Vlastní doména (volitelné)

V nastavení projektu: **Custom domains** → přidejte vlastní doménu nebo použijte výchozí `*.pages.dev` adresu.

## Aktualizace

Každý push do větve `main` automaticky spustí nové nasazení na Cloudflare Pages.
