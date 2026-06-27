/* =====================================================================
   PaDi Shooter 89 - Teams & Competitions
   Pick any club or country, in any league or cup!

   Each team has kit colours that become the player's shirt in the game:
     primary   = main shirt colour
     secondary = stripe / trim colour
     text      = number / detail colour (should contrast with primary)
   ===================================================================== */
(function () {
  'use strict';
  const PADI = (window.PADI = window.PADI || {});

  // small helper to build a team object
  const T = (name, short, primary, secondary, text) => ({
    name,
    short,
    primary,
    secondary,
    text: text || '#ffffff',
  });

  // ---------------------------------------------------------------------
  //  NATIONAL TEAMS (shared between the World Cup and the Euros)
  // ---------------------------------------------------------------------
  const NAT = {
    POR: T('Portugal', 'POR', '#d8000c', '#0a6b2d', '#ffd700'),
    NED: T('Netherlands', 'NED', '#ff7a00', '#ffffff', '#ffffff'),
    ESP: T('Spain', 'ESP', '#c60b1e', '#ffc400', '#ffc400'),
    FRA: T('France', 'FRA', '#1a2f6b', '#ffffff', '#ffffff'),
    ENG: T('England', 'ENG', '#ffffff', '#cf081f', '#001489'),
    GER: T('Germany', 'GER', '#ffffff', '#000000', '#000000'),
    ITA: T('Italy', 'ITA', '#0066a8', '#ffffff', '#ffffff'),
    BEL: T('Belgium', 'BEL', '#c8102e', '#ffd700', '#000000'),
    CRO: T('Croatia', 'CRO', '#e2120a', '#ffffff', '#1037a3'),
    BRA: T('Brazil', 'BRA', '#ffdf00', '#009c3b', '#002776'),
    ARG: T('Argentina', 'ARG', '#75aadb', '#ffffff', '#0b3d91'),
    URU: T('Uruguay', 'URU', '#58a5dc', '#ffffff', '#0b1b3a'),
    MEX: T('Mexico', 'MEX', '#006847', '#ffffff', '#ce1126'),
    USA: T('USA', 'USA', '#ffffff', '#002868', '#bf0a30'),
    JPN: T('Japan', 'JPN', '#0b1f8f', '#ffffff', '#ffffff'),
    KOR: T('South Korea', 'KOR', '#cd2e3a', '#0047a0', '#ffffff'),
    MAR: T('Morocco', 'MAR', '#c1272d', '#0a6b2d', '#ffffff'),
    SEN: T('Senegal', 'SEN', '#0a8a3e', '#ffd700', '#e2120a'),
    DEN: T('Denmark', 'DEN', '#c60c30', '#ffffff', '#ffffff'),
    SWE: T('Sweden', 'SWE', '#1d5fa8', '#fecc00', '#fecc00'),
    SUI: T('Switzerland', 'SUI', '#d52b1e', '#ffffff', '#ffffff'),
    POL: T('Poland', 'POL', '#ffffff', '#dc143c', '#dc143c'),
    TUR: T('Turkey', 'TUR', '#e30a17', '#ffffff', '#ffffff'),
    SCO: T('Scotland', 'SCO', '#0a4789', '#ffffff', '#ffffff'),
    AUT: T('Austria', 'AUT', '#ed2939', '#ffffff', '#ffffff'),
    NOR: T('Norway', 'NOR', '#ba0c2f', '#ffffff', '#00205b'),
  };

  const euroNations = [
    NAT.POR, NAT.NED, NAT.ESP, NAT.FRA, NAT.ENG, NAT.GER, NAT.ITA, NAT.BEL,
    NAT.CRO, NAT.DEN, NAT.SWE, NAT.SUI, NAT.POL, NAT.TUR, NAT.SCO, NAT.AUT,
    NAT.NOR,
  ];

  const worldNations = [
    NAT.POR, NAT.NED, NAT.ESP, NAT.FRA, NAT.ENG, NAT.GER, NAT.ITA, NAT.BEL,
    NAT.CRO, NAT.BRA, NAT.ARG, NAT.URU, NAT.MEX, NAT.USA, NAT.JPN, NAT.KOR,
    NAT.MAR, NAT.SEN, NAT.DEN, NAT.SUI,
  ];

  // ---------------------------------------------------------------------
  //  COMPETITIONS  (leagues + cups)
  // ---------------------------------------------------------------------
  const competitions = [
    {
      id: 'wc',
      name: 'World Cup (WK)',
      emoji: '🌍',
      teams: worldNations,
    },
    {
      id: 'euro',
      name: 'Euros (EK)',
      emoji: '🏆',
      teams: euroNations,
    },
    {
      id: 'ucl',
      name: 'Champions League',
      emoji: '⭐',
      teams: [
        T('Real Madrid', 'RMA', '#ffffff', '#febe10', '#1a2a5e'),
        T('FC Barcelona', 'BAR', '#a50044', '#004d98', '#ffed02'),
        T('Manchester City', 'MCI', '#6cabdd', '#ffffff', '#1c2c5b'),
        T('Bayern München', 'BAY', '#dc052d', '#ffffff', '#ffffff'),
        T('Paris SG', 'PSG', '#0a2747', '#da291c', '#ffffff'),
        T('Liverpool', 'LIV', '#c8102e', '#ffffff', '#ffd700'),
        T('Inter Milan', 'INT', '#0a64a4', '#000000', '#ffffff'),
        T('FC Porto', 'POR', '#0046ad', '#ffffff', '#ffffff'),
        T('Benfica', 'BEN', '#e2120a', '#ffffff', '#ffffff'),
        T('Ajax', 'AJA', '#d2122e', '#ffffff', '#ffffff'),
        T('Dortmund', 'BVB', '#fde100', '#000000', '#000000'),
        T('Juventus', 'JUV', '#ffffff', '#000000', '#000000'),
      ],
    },
    {
      id: 'laliga',
      name: 'La Liga (Spain)',
      emoji: '🇪🇸',
      teams: [
        T('Real Madrid', 'RMA', '#ffffff', '#febe10', '#1a2a5e'),
        T('FC Barcelona', 'BAR', '#a50044', '#004d98', '#ffed02'),
        T('Atlético Madrid', 'ATM', '#cb3524', '#ffffff', '#1d2a4d'),
        T('Sevilla', 'SEV', '#ffffff', '#d81f2a', '#d81f2a'),
        T('Valencia', 'VAL', '#ffffff', '#f7a800', '#000000'),
        T('Real Betis', 'BET', '#00954c', '#ffffff', '#ffffff'),
        T('Athletic Bilbao', 'ATH', '#ee2523', '#ffffff', '#ffffff'),
        T('Real Sociedad', 'RSO', '#143c8b', '#ffffff', '#ffffff'),
        T('Villarreal', 'VIL', '#ffe667', '#003d7c', '#003d7c'),
      ],
    },
    {
      id: 'primeira',
      name: 'Primeira Liga (Portugal)',
      emoji: '🇵🇹',
      teams: [
        T('Benfica', 'BEN', '#e2120a', '#ffffff', '#ffffff'),
        T('FC Porto', 'FCP', '#0046ad', '#ffffff', '#ffffff'),
        T('Sporting CP', 'SCP', '#008057', '#ffffff', '#ffffff'),
        T('SC Braga', 'BRA', '#b2122b', '#ffffff', '#ffffff'),
        T('Vitória SC', 'VSC', '#ffffff', '#000000', '#000000'),
        T('Boavista', 'BOA', '#000000', '#ffffff', '#ffffff'),
      ],
    },
    {
      id: 'premier',
      name: 'Premier League (England)',
      emoji: '🏴',
      teams: [
        T('Manchester City', 'MCI', '#6cabdd', '#ffffff', '#1c2c5b'),
        T('Arsenal', 'ARS', '#ef0107', '#ffffff', '#023474'),
        T('Liverpool', 'LIV', '#c8102e', '#ffffff', '#ffd700'),
        T('Manchester United', 'MUN', '#da291c', '#ffe500', '#ffffff'),
        T('Chelsea', 'CHE', '#034694', '#ffffff', '#ffffff'),
        T('Tottenham', 'TOT', '#ffffff', '#132257', '#132257'),
        T('Newcastle', 'NEW', '#241f20', '#ffffff', '#ffffff'),
      ],
    },
    {
      id: 'eredivisie',
      name: 'Eredivisie (Netherlands)',
      emoji: '🇳🇱',
      teams: [
        T('Ajax', 'AJA', '#d2122e', '#ffffff', '#ffffff'),
        T('PSV', 'PSV', '#ed1c24', '#ffffff', '#ffffff'),
        T('Feyenoord', 'FEY', '#cc0000', '#ffffff', '#000000'),
        T('AZ Alkmaar', 'AZ', '#ed1c24', '#ffffff', '#ffffff'),
        T('FC Twente', 'TWE', '#ed1c24', '#ffffff', '#ffffff'),
        T('FC Utrecht', 'UTR', '#ed1c24', '#000000', '#000000'),
      ],
    },
    {
      id: 'seriea',
      name: 'Serie A (Italy)',
      emoji: '🇮🇹',
      teams: [
        T('Inter', 'INT', '#0a64a4', '#000000', '#ffffff'),
        T('AC Milan', 'MIL', '#fb090b', '#000000', '#ffffff'),
        T('Juventus', 'JUV', '#ffffff', '#000000', '#000000'),
        T('Napoli', 'NAP', '#199fdb', '#ffffff', '#ffffff'),
        T('AS Roma', 'ROM', '#8e1f2f', '#f0bc42', '#f0bc42'),
        T('Lazio', 'LAZ', '#87d8f7', '#ffffff', '#13366b'),
      ],
    },
    {
      id: 'bundesliga',
      name: 'Bundesliga (Germany)',
      emoji: '🇩🇪',
      teams: [
        T('Bayern München', 'BAY', '#dc052d', '#ffffff', '#ffffff'),
        T('Dortmund', 'BVB', '#fde100', '#000000', '#000000'),
        T('RB Leipzig', 'RBL', '#ffffff', '#dd0741', '#001f47'),
        T('Bayer Leverkusen', 'LEV', '#e32219', '#000000', '#ffffff'),
        T('Schalke 04', 'S04', '#004d9d', '#ffffff', '#ffffff'),
        T('Eintracht Frankfurt', 'SGE', '#000000', '#e1000f', '#ffffff'),
      ],
    },
    {
      id: 'ligue1',
      name: 'Ligue 1 (France)',
      emoji: '🇫🇷',
      teams: [
        T('Paris SG', 'PSG', '#0a2747', '#da291c', '#ffffff'),
        T('AS Monaco', 'MON', '#e63312', '#ffffff', '#ffffff'),
        T('Marseille', 'OM', '#ffffff', '#2faee0', '#2faee0'),
        T('Lyon', 'OL', '#ffffff', '#da001a', '#1c3f95'),
        T('Lille', 'LIL', '#e01e13', '#ffffff', '#10284a'),
      ],
    },
  ];

  // a sensible default kit if anything is ever missing
  const DEFAULT = T('Free Kickers', 'PADI', '#3a86ff', '#1d4ed8', '#ffffff');

  PADI.Teams = {
    competitions,
    DEFAULT,
    // find a competition by id (falls back to the first one)
    comp(id) {
      return competitions.find((c) => c.id === id) || competitions[0];
    },
  };
})();
