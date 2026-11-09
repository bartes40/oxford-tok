# ⚡ OXFORD-TOK // Dopamine English SRS Feed

A dopamine-engineered, TikTok-style English vocabulary acquisition web application powered by **Oxford 3000™**, an embedded **SQLite database**, and an adaptive **SM-2 Spaced Repetition System (SRS)**.

Designed with a high-contrast neo-brutalist / modern editorial aesthetic inspired by cutting-edge creative typography, vibrant electric blue palettes, and playful sticker badges.

---

## 🎯 Główne Funkcjonalności & Mechanizmy Dopaminowe

### 1. 📱 TikTok Vertical Feed Engine
* **Płynny swipe góra/dół**: Przesuwaj palcem (touch gesture), rolką myszy (debounced wheel snap) lub klawiaturą (`↑`/`↓`, `j`/`k`).
* **Interakcja "Tap to Reveal"**: Karta początkowo prezentuje słowo, transkrypcję fonetyczną IPA i definicję po angielsku. Dotknięcie karty lub wciśnięcie spacji natychmiast odsłania polskie znaczenie, przykłady i haki pamięciowe.
* **Boczny pasek akcji (TikTok Action Rail)**:
  * 🔊 **Wymowa Audio**: Odsłuchiwanie wymowy w standardzie Oxford (British English 🇬🇧) oraz American English 🇺🇸.
  * 🐢 **Zwolnione tempo 0.7x**: Do precyzyjnej analizy fonemów.
  * ❤️ **Ulubione (Save/Bookmark)**: Szybkie dodawanie słówek do powtórek VIP.
  * 📖 **Oxford Deep Dive**: Pełny wpis słownikowy (kolokacje, synonimy, antonimy, haki mnemoniczne, parametry SRS).
  * ⚡ **Pop Quiz**: Błyskawiczny 10-sekundowy quiz wyboru z nagrodami XP i konfetti.
  * 🔗 **Share / Kopiowanie**: Jedno kliknięcie kopiuje sformatowaną fiszkę do schowka.

### 2. 🧠 Algorytm SM-2 Spaced Repetition (SRS)
* Realizuje matematyczny model powtórek interwałowych SuperMemo SM-2:
  * 🔴 **Again (1)**: Reset powtórzeń, ponowne pojawienie się w sesji po ~1 minucie, redukcja współczynnika łatwości (*Ease Factor*).
  * 🟠 **Hard (2)**: Interwał wzrasta ostrożnie (12h lub $\times 1.2$), niewielka korekta *Ease Factor*.
  * 🟢 **Good (3)**: Klasyczny progres: 1 dzień $\to$ 3 dni $\to$ $\text{interwał} \times \text{Ease Factor}$.
  * 🔵 **Easy (4)**: Błyskawiczne opanowanie: 2.5 dnia $\to$ 6 dni $\to$ bonus $\times 1.35$, wzrost *Ease Factor*.
* **Dynamiczne etykiety interwałów**: Przyciski na bieżąco kalkulują i pokazują czas powrotu słowa (`+1m`, `+1d`, `+3d`, `+6d`).
* **Inteligentny Smart Feed**:
  1. W pierwszej kolejności serwuje karty zaległe do powtórki (*Due SRS*).
  2. W drugiej kolejności karty w trakcie utrwalania (*Learning*).
  3. Płynnie przeplata nowe słówka z bazy Oxford 3000 w progresji częstotliwości.

### 3. 🎮 Pętle Dopaminowe i Grywalizacja
* 🔥 **Licznik Dni Streaka**: Płomień podtrzymujący codzienny nawyk z animowanym maskotkiem Sparky!
* ⚡ **Floating XP**: Każda ocena generuje animowany badge `+22 XP`, `+35 XP`, `COMBO!`.
* 🏆 **System Poziomów**: Od *Word Spark (Lvl 1)*, przez *Vocab Novice (Lvl 2)*, *Oxford Explorer (Lvl 3)* aż po *Polyglot Elite (Lvl 7)*.
* 🎉 **Canvas Confetti**: Eksplozje cząsteczek przy osiąganiu kamieni milowych i poprawnych odpowiedziach w quizie.
* 🎵 **Silnik Dźwiękowy Web Audio API**: Bezatencyjne, syntetyzowane chrupnięcia, chimes, fanfary i dźwięki przeciągnięć (z opcją wyciszenia).
* 🎯 **Dzienny Cel**: Pasek postępu (np. 15 słówek dziennie).

### 4. 📚 Baza Oxford 3000 & Słownik Oxford Learner's Dictionary
* Wbudowana baza **SQLite** (`data/oxford.db`) z indeksem CEFR i tabelami SRS:
  * `word`: hasło słownikowe
  * `phonetic`: transkrypcja IPA (np. `/əˈbændən/`, `/ˈkæptɪveɪt/`)
  * `cefr_level`: poziomy A1, A2, B1, B2, C1
  * `part_of_speech`: verb, noun, adjective, adverb
  * `definition_en`: definicja Oxford Learner's Dictionary pisana uproszczonym zasobem Oxford 3000
  * `definition_pl`: precyzyjne polskie tłumaczenie kontekstowe
  * `example_en` & `example_pl`: autentyczne zdania przykładowe z wyróżnionym słowem kluczowym
  * `collocations`: zestaw najczęstszych kolokacji leksykalnych
  * `synonyms` & `antonyms`: słownictwo powiązane
  * `memory_hook`: mnemotechniczne haki ułatwiające natychmiastowe zapamiętanie

---

## 🛠️ Architektura Technologiczna

* **Backend**: Node.js + Express + natywna baza `node:sqlite` (SQLite z trybem WAL dla maksymalnej wydajności i bez zewnętrznych zależności kompilacji).
* **Frontend**: React 19 + Vite 8 + Tailwind CSS v4.
* **Efekty dźwiękowe**: Web Audio API (proceduralne syntezatory dźwięku 0ms latency).
* **Wymowa**: Web Speech API (`SpeechSynthesisUtterance`) ze wsparciem dla akcentów brytyjskich i amerykańskich.
* **Grywalizacja**: Canvas-Confetti, algorytm SM-2 SRS, statystyki leksykalne CEFR.

---

## 🚀 Uruchomienie Aplikacji

Serwer uruchamia się jedną prostą komendą, która integruje zarówno backend API SQLite, jak i frontend Vite:

```bash
# Uruchomienie w trybie developerskim
npm run dev
```

Aplikacja będzie dostępna pod adresem:
👉 **`http://localhost:3000`**

### Dodatkowe komendy:
```bash
# Ponowne zasilenie / odświeżenie bazy Oxford 3000
npm run seed

# Zbudowanie wersji produkcyjnej
npm run build
```

---

## ⌨️ Skróty Klawiszowe

| Klawisz | Akcja |
| :--- | :--- |
| `↓` / `j` | Następne słówko w feedzie |
| `↑` / `k` | Poprzednie słówko |
| `Spacja` / `Enter` | Odsłoń / ukryj polskie tłumaczenie i przykład |
| `1` | SRS: Again (+1m, 5 XP) |
| `2` | SRS: Hard (+1d, 12 XP) |
| `3` | SRS: Good (+3d, 22 XP) |
| `4` | SRS: Easy (+6d, 35 XP) |
