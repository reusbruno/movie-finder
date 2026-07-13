import type { Dictionary } from "./en";

// Typed against en.ts's exact shape - a missing or extra key here is a
// compile error, not a silent runtime fallback to English.
const ptBR: Dictionary = {
  common: {
    loading: "Carregando…",
    loadMore: "Carregar mais",
    searching: "Buscando…",
    noMatches: "Nenhum resultado",
    noPosterAvailable: "Pôster não disponível",
    unknownYear: "Ano desconhecido",
    tryAgain: "Tentar novamente",
    clear: "Limpar",
  },
  header: {
    watchlist: "Minha Lista",
    movies: "Filmes",
    series: "Séries",
    contentModeAriaLabel: "Modo de conteúdo",
    languageAriaLabel: "Idioma",
    searchTitlesAndPeople: "Buscar títulos e pessoas",
    searchTitlesPlaceholder: "Buscar títulos…",
    people: "Pessoas",
  },
  hero: {
    heading: "O que você quer assistir hoje?",
    moodPlaceholder: "Descreva um clima… ex: ficção científica melancólica e lenta",
    moodAriaLabel: "Busca por clima",
    thinking: "Pensando…",
    find: "Buscar",
    firstTitle: "Primeiro título…",
    secondTitle: "Segundo título…",
    blending: "Combinando…",
    blend: "Combinar",
    pickTwoDifferent: "Escolha dois títulos diferentes para combinar",
    backToMood: "← Busca por clima",
    moodComingSoon: "Busca por clima — em breve",
    blendTwoTitles: "Combinar dois títulos",
    picking: "Escolhendo…",
    surpriseMe: "Me surpreenda",
    browseWithFilters: "Navegar com filtros",
  },
  interpretation: {
    label: "Interpretado como",
    noFilters: "Nenhum filtro específico",
  },
  filters: {
    panel: "Filtros",
    genres: "Gêneros",
    streamingOn: "Disponível em",
    sortBy: "Ordenar por",
    minImdb: "IMDb mín.",
    minRt: "RT mín.",
    any: "Qualquer",
  },
  results: {
    heading: (context: string, count: number) =>
      `${context} · ${count} ${count === 1 ? "resultado" : "resultados"}`,
    blendingCaption: (titleA: string, titleB: string) => `Combinando: ${titleA} + ${titleB}`,
    resultsFor: (query: string) => `Resultados para "${query}"`,
    filtered: "Filtrado",
  },
  grid: {
    noResults: "Nenhum resultado encontrado.",
  },
  watchlistButton: {
    removeAria: (title: string) => `Remover ${title} da lista`,
    addAria: (title: string) => `Adicionar ${title} à lista`,
    removeTooltip: "Remover da lista",
    addTooltip: "Adicionar à lista",
    posterAlt: (title: string) => `Pôster de ${title}`,
  },
  explain: {
    expanding: "Expandindo…",
    explainMore: "Saiba mais",
    failedToExpand: "Falha ao expandir a explicação",
  },
  sortLabels: {
    "popularity.desc": "Popularidade",
    "vote_average.desc": "Mais bem avaliados",
    "primary_release_date.desc": "Mais recentes",
    "title.asc": "Título (A-Z)",
    "first_air_date.desc": "Mais recentes",
    "name.asc": "Título (A-Z)",
  },
  watchProviders: {
    stream: "Assistir",
    rent: "Alugar",
    buy: "Comprar",
    whereToWatch: "Onde assistir",
    region: "Região",
    moreInfoOnTmdb: "Mais informações no TMDB →",
  },
  watchRegionLabels: {
    US: "Estados Unidos",
    BR: "Brasil",
  },
  watchlist: {
    empty: "Sua lista está vazia. Adicione títulos a partir de qualquer card de filme ou série.",
    loadError: "Falha ao carregar sua lista. Tente atualizar a página.",
  },
  titlePicker: {
    searchFailed: "Falha na busca",
    clear: (title: string) => `Remover ${title}`,
  },
  actorFilmography: {
    from: "De",
    to: "Até",
    yearPlaceholder: "Ano",
  },
  cast: {
    noPhoto: "Foto não disponível",
    asCharacter: (character: string) => `como ${character}`,
  },
  filmography: {
    tvSuffix: " · TV",
    noResults: "Nada corresponde a esses filtros.",
  },
  tmdbAttribution: {
    logoAlt: "Logotipo do The Movie Database (TMDB)",
    text: "Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.",
  },
  notFound: {
    heading: "Página não encontrada",
    body: "Não conseguimos encontrar o que você procurava. Pode ter sido removido, ou o link pode estar incorreto.",
    backToMovies: "Voltar para Filmes",
  },
  errorPage: {
    heading: "Algo deu errado",
    defaultMessage: "Ocorreu um erro inesperado.",
  },
  movies: {
    searchPlaceholder: "Buscar filmes…",
    searchAriaLabel: "Buscar filmes",
    popularHeading: "Filmes populares",
    errors: {
      failedToLoad: "Falha ao carregar filmes",
      failedToSearch: "Falha ao buscar filmes",
    },
  },
  series: {
    searchPlaceholder: "Buscar séries…",
    searchAriaLabel: "Buscar séries",
    popularHeading: "Séries populares",
    ratingsFootnote:
      "As notas do Rotten Tomatoes costumam estar indisponíveis para séries em nossa fonte de dados, mesmo para as mais populares — uma nota ausente não significa que ela não exista em outro lugar.",
    errors: {
      failedToLoad: "Falha ao carregar séries",
      failedToSearch: "Falha ao buscar séries",
    },
  },
  errors: {
    tooManySearches: "Muitas buscas — aguarde um instante e tente novamente.",
    failedToInterpretMood: "Falha ao interpretar a busca por clima",
    noTitlesMatchFilters: "Nenhum título corresponde aos filtros atuais.",
    failedToPickSurprise: "Falha ao escolher um título surpresa",
    failedToBlend: "Falha ao combinar títulos",
  },
  yearRange: {
    through: (year: number) => `até ${year}`,
  },
};

export default ptBR;
