/** Curated league hero backgrounds — ~10 per competition, rotated daily. */

const DEFAULT_HERO_IMAGES = [
  "/images/hero_1.jpg",
  "/images/hero_2.jpg",
  "/images/hero_4.jpg",
  "/images/hero_5.jpg",
  "/images/hero_6.jpg",
]

// Wikimedia Commons + Unsplash (free to use). Stadium / match photos per league.
const LEAGUE_HERO_IMAGES = {
  CRC: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Estadio_Nacional_de_Costa_Rica%2C_2011.jpg/1920px-Estadio_Nacional_de_Costa_Rica%2C_2011.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Estadio_nacional_costarica.jpg/1920px-Estadio_nacional_costarica.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Estadio_Nacional%2C_San_Jos%C3%A9%2C_Costa_Rica._-_panoramio_%281%29.jpg/1920px-Estadio_Nacional%2C_San_Jos%C3%A9%2C_Costa_Rica._-_panoramio_%281%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Estadio_Nacional_de_Costa_Rica_durante_la_XV_edici%C3%B3n_de_los_90_minutos_por_la_vida%2C_2015.JPG/1920px-Estadio_Nacional_de_Costa_Rica_durante_la_XV_edici%C3%B3n_de_los_90_minutos_por_la_vida%2C_2015.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/0/01/Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/0/0e/Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-2.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/6/67/Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-3.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/f/f8/Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-4.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-7.jpg/1920px-Costa_Rica_vs._Espa%C3%B1a_%28amistoso%29_-7.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/9/90/Archivo-Inauguraci%C3%B3n_Estadio_Nacional_de_Costa_Rica_-13.jpg",
  ],
  LMX: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Azteca_Stadium_-_panoramio.jpg/1920px-Azteca_Stadium_-_panoramio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Estadio_Azteca_-_panoramio.jpg/1920px-Estadio_Azteca_-_panoramio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Estadio_Azteca_%28detalle%29.jpg/1920px-Estadio_Azteca_%28detalle%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/9/96/Azteca_entrance.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/4/44/BUENOS_D%C3%8DAS%2C_M%C3%89XICO_AS%C3%8D_DESPIERTA_EL_ESTADIO_CIUDAD_DE_M%C3%89XICO_PARA_EL_MUNDIAL.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/d/dc/BUENOS_D%C3%8DAS%2C_M%C3%89XICO_AS%C3%8D_DESPIERTA_EL_ESTADIO_CIUDAD_DE_M%C3%89XICO_PARA_EL_MUNDIAL_%282%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/f/f6/BUENOS_D%C3%8DAS%2C_M%C3%89XICO_AS%C3%8D_DESPIERTA_EL_ESTADIO_CIUDAD_DE_M%C3%89XICO_PARA_EL_MUNDIAL_%289%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/9/99/Entrando_al_estadio_Azteca_-_panoramio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/3/31/Estadio_Azteca_2.JPG",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
  ],
  PL: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/2019_FA_Cup_final.jpg/1920px-2019_FA_Cup_final.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_01.jpg/1920px-2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_02.jpg/1920px-2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_02.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_03.jpg/1920px-2023_Challenge_Cup_Final_Wembley_Stadium_from_Olympic_Way_03.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/67017_and_Wembley_Stadium.jpg/1920px-67017_and_Wembley_Stadium.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/e/ec/2014_FA_Trophy_Final%2C_goal%5E_-_geograph.org.uk_-_3898140.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/8/82/2014_FA_Trophy_Final%2C_the_teams_emerge_-_geograph.org.uk_-_3898136.jpg",
    "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1560272564-c83b4dd4bb27?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
  ],
  LAL: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%281%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%281%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2810%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2810%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2811%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2811%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2812%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2812%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/4/42/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2815%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/e/e6/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2816%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2817%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%2817%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%283%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%283%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%284%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%284%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/3/34/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%282%29.JPG",
  ],
  BL1: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/2014_Allianz_Arena.JPG/1920px-2014_Allianz_Arena.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/20200228_Allianz_Arena_01.jpg/1920px-20200228_Allianz_Arena_01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/2012-05-19_Finale05_%287232997484%29.jpg/1920px-2012-05-19_Finale05_%287232997484%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/2012-05-19_Finale06_%287232997278%29.jpg/1920px-2012-05-19_Finale06_%287232997278%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/2011-03-12_FCBayern2_%285527414108%29.jpg/1920px-2011-03-12_FCBayern2_%285527414108%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/2011-03-12_FCBayern3_%285527414382%29.jpg/1920px-2011-03-12_FCBayern3_%285527414382%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/2007_Fr%C3%B6ttmaning_02.jpg/1920px-2007_Fr%C3%B6ttmaning_02.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/05.09.2010._M%C3%BCnchen_-_panoramio.jpg/1920px-05.09.2010._M%C3%BCnchen_-_panoramio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/20190816S%C3%BCdliche_Fr%C3%B6ttmaninger_Heide_11.jpg/1920px-20190816S%C3%BCdliche_Fr%C3%B6ttmaninger_Heide_11.jpg",
    "https://images.unsplash.com/photo-1575368838369-8966c6366a96?auto=format&fit=crop&w=1600&q=80",
  ],
  SA: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/2012-05-19_Finale06_%287232997278%29.jpg/1920px-2012-05-19_Finale06_%287232997278%29.jpg",
    "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1431324155629-2a467a053bd4?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1526232762012-60ec059c6789?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1579952363873-27f3bdeea884?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1551958219-2798480b5648?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/2012-05-19_Finale05_%287232997484%29.jpg/1920px-2012-05-19_Finale05_%287232997484%29.jpg",
  ],
  L1: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/France-Israel_Stade_de_France_01.jpg/1920px-France-Israel_Stade_de_France_01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/France-Israel_Stade_de_France_02.jpg/1920px-France-Israel_Stade_de_France_02.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/France-Israel_Stade_de_France_03.jpg/1920px-France-Israel_Stade_de_France_03.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/France-Israel_Stade_de_France_04.jpg/1920px-France-Israel_Stade_de_France_04.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/France-Israel_Stade_de_France_05.jpg/1920px-France-Israel_Stade_de_France_05.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/France-Israel_Stade_de_France_06.jpg/1920px-France-Israel_Stade_de_France_06.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/France-Israel_Stade_de_France_07.jpg/1920px-France-Israel_Stade_de_France_07.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/France-Israel_Stade_de_France_08.jpg/1920px-France-Israel_Stade_de_France_08.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/France-Israel_Stade_de_France_09.jpg/1920px-France-Israel_Stade_de_France_09.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/France-Israel_Stade_de_France_10.jpg/1920px-France-Israel_Stade_de_France_10.jpg",
  ],
  MLS: [
    "https://upload.wikimedia.org/wikipedia/commons/b/b4/Arsenal_Man_U_Metlife_Stadium_July_2023_%28cropped%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/e/ec/Arsenal_Man_U_Metlife_Stadium_July_2023.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/161113-N-QJ850-015_161113-N-QJ850-015.jpg/1920px-161113-N-QJ850-015_161113-N-QJ850-015.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/161113-N-QJ850-064_161113-N-QJ850-064.jpg/1920px-161113-N-QJ850-064_161113-N-QJ850-064.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/b/b3/2011_Jets.jpg",
    "https://images.unsplash.com/photo-1560272564-c83b4dd4bb27?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1575368838369-8966c6366a96?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
  ],
  UCL: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/2012-05-19_Finale05_%287232997484%29.jpg/1920px-2012-05-19_Finale05_%287232997484%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/2012-05-19_Finale06_%287232997278%29.jpg/1920px-2012-05-19_Finale06_%287232997278%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/2019_FA_Cup_final.jpg/1920px-2019_FA_Cup_final.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/-2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%281%29.JPG/1920px--2009-04-18_Camp_Nou_stadium%2C_Barcalona%2C_Spain_%281%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/2014_Allianz_Arena.JPG/1920px-2014_Allianz_Arena.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/67017_and_Wembley_Stadium.jpg/1920px-67017_and_Wembley_Stadium.jpg",
    "https://images.unsplash.com/photo-1575368838369-8966c6366a96?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1431324155629-2a467a053bd4?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1560272564-c83b4dd4bb27?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
  ],
}

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Pick a hero image for a league. Random by default; pass extraSeed for a stable pick (e.g. team slug). */
export function pickLeagueHeroImage(code, extraSeed = "") {
  const key = (code || "").toUpperCase()
  const pool = LEAGUE_HERO_IMAGES[key] || DEFAULT_HERO_IMAGES
  const idx = extraSeed
    ? hashCode(`${key}|${extraSeed}`) % pool.length
    : Math.floor(Math.random() * pool.length)
  return pool[idx]
}

export function leagueHeroStyle(code, extraSeed = "") {
  const url = pickLeagueHeroImage(code, extraSeed)
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }
}
