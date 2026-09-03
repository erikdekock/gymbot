// ===========================================================================
//  Book configuration.
//  One place for the things that describe *this* book rather than the reader,
//  plus every user-facing copy string, so text can be edited without touching
//  components. `lang` drives the reading column's lang attribute, which is what
//  the browser uses to pick a hyphenation dictionary for justified text — set
//  it to 'nl' when the Dutch text lands and hyphenation follows automatically.
// ===========================================================================

export const BOOK = {
  title: 'Het Zal',
  author: 'Erik de Kock',
  lang: 'nl',
  // Words per "locatie" — the Kindle-style stable position unit. Changing this
  // renumbers every location, so only change it deliberately.
  wordsPerLocation: 150,
}

// --- Landing page + sign-in -------------------------------------------------
export const COPY = {
  landing: {
    eyebrow: 'Een boek',
    title: BOOK.title,
    author: BOOK.author,
    intro:
      'Fijn dat je meeleest. Vul je e-mailadres in en je krijgt een link waarmee je meteen verder kunt — geen wachtwoord, niets te onthouden.',
    emailLabel: 'E-mailadres',
    emailPlaceholder: 'jij@voorbeeld.nl',
    submit: 'Stuur me de link',
    submitting: 'Bezig…',
    sentTitle: 'Kijk even in je mail',
    sentBody:
      'Ik heb je een link gestuurd. Klik erop en je zit meteen in het boek, op de plek waar je gebleven was.',
    sentAgain: 'Geen mail gekregen? Probeer het opnieuw.',
    error: 'Dat ging even mis. Probeer het nog een keer.',
    invalidEmail: 'Vul een geldig e-mailadres in.',
    privacy: 'Zo ga ik met je gegevens om',
  },

  // --- First-run name capture (the old welcome modal, reframed) -------------
  welcome: {
    title: 'Welkom',
    body: 'Hoe mag ik je noemen? Zo weet ik wie er meeleest.',
    firstName: 'Voornaam',
    lastName: 'Achternaam',
    submit: 'Begin met lezen',
    skip: 'Sla over',
    subscribe: 'Houd me op de hoogte van Het Zal — nieuws over dit boek en wat er volgt.',
  },

  // --- Consent notice -------------------------------------------------------
  consent: {
    body: 'Ik houd bij hoe er gelezen wordt, om het boek beter te maken. Geen advertenties, geen doorverkoop.',
    accept: 'Prima',
    decline: 'Liever niet',
    more: 'Lees hoe het zit',
  },

  // --- Reader chrome --------------------------------------------------------
  reader: {
    locationLabel: (n, total) => `Locatie ${fmt(n)} van ${fmt(total)}`,
    chapterLabel: (n) => `Hoofdstuk ${n}`,
    percentThrough: (p) => `${p}% door het boek`,
    resume: 'Welkom terug — je was hier gebleven',
    restart: 'Begin opnieuw',
    theEnd: 'Einde',
  },

  // --- Selection popup ------------------------------------------------------
  selection: {
    highlight: 'Markeer',
    comment: 'Notitie',
    like: 'Mooi',
    ask: 'Stel een vraag',
  },

  // --- Ask-a-question composer ---------------------------------------------
  question: {
    title: 'Stel een vraag',
    body: 'Je vraag komt rechtstreeks bij mij binnen. Ik antwoord persoonlijk.',
    placeholder: 'Wat wil je vragen?',
    submit: 'Verstuur',
    submitting: 'Versturen…',
    sent: 'Je vraag is aangekomen. Ik antwoord je persoonlijk.',
    error: 'Versturen lukte niet. Je vraag is wel bewaard — ik zie hem alsnog.',
    cancel: 'Annuleer',
  },

  // --- Feedback -------------------------------------------------------------
  feedback: {
    title: 'Wat vind je?',
    body: 'Alles is welkom: een losse gedachte, een verbeterpunt, een tikfout.',
    placeholder: 'Schrijf hier…',
    submit: 'Verstuur',
    sent: 'Dank je. Aangekomen.',
    cancel: 'Annuleer',
  },

  // --- Surveys --------------------------------------------------------------
  survey: {
    chapterDone: (n) => `Je hebt hoofdstuk ${n} uit`,
    endOfBook: 'Je hebt het boek uit',
    submit: 'Versturen',
    skip: 'Sla over',
    thanks: 'Dank je wel.',
    openPlaceholder: 'Optioneel — schrijf hier…',
  },

  // --- Account --------------------------------------------------------------
  account: {
    signOut: 'Uitloggen',
    forget: 'Vergeet mij',
    forgetConfirm:
      'Weet je het zeker? Dit verwijdert je account en alles wat je hebt gelezen, gemarkeerd en gevraagd. Dit kan niet ongedaan worden gemaakt.',
    forgetDone: 'Alles is verwijderd. Het ga je goed.',
    cancel: 'Annuleer',
  },
}

// 1860 -> "1.860" (Dutch thousands separator)
function fmt(n) {
  return new Intl.NumberFormat('nl-NL').format(Math.round(n || 0))
}

export const formatNumber = fmt
