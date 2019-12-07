/*jshint jquery:true */

var SUITS = ["Hearts", "Spades", "Diamonds", "Clubs"],
    RANKS = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"],
    HEARTS = 0,
    SPADES = 1,
    DIAMONDS = 2,
    CLUBS = 3;

// Représente un déplacement du jeu
var Move = (function() {
  function Move(card_id, source_id, stack) {
    // ID de la carte déplacée, ou
    // - "draw" pour conseiller tirage pioche
    // - "list" pour marquer début et fin d'une série de mouvements
    this.card_id = card_id;

    // ID de la pile de départ
    this.source_id = source_id;

    // Pile d'arrivée (ou null si déplacement correspond à un retournement)
    this.stack = stack;
  }

  return Move;
}());

// Représente une carte
var Card = (function() {
  function Card(id) {
    // ID de la carte (0 à 51)
    this.id = id;

    // Valeur de la carte (0-As, 1=Deux, 2=Trois, ..., 9=Dix, 10=Valet, 11=Dame, 12=Roi)
    this.rank = id % 13;
    // Suite de la carte (0=Coeur, 1=Pique, 2=Carreau, 3=Trèfle)
    this.suit = Math.floor(id / 13);

    // Colori de la carte (rouge ou noir)
    this.red = this.suit === HEARTS || this.suit === DIAMONDS;
    this.black = !this.red;

    // Carte face non visible par défaut
    this.faceUp = false;

    // Carte non sélectionnée par défaut
    this.selected = false;

    // ID pour la balise HTML (c00 à c51)
    this.html_id = SUITS[this.suit][0] + (this.rank === 9 ? "T" : RANKS[this.rank][0]);

    // Balise HTML pour représenter la carte
    // <div id='c##' class='card down'></div>
    this.html = "<div id='" + this.html_id + "' class='card down'></div>";
  }

  Card.prototype.isAce = function() {
    return this.rank === 0;
  };

  Card.prototype.isKing = function() {
    return this.rank === 12;
  };

  Card.prototype.toHtml = function() {
    var html = this.html;
    if (this.selected) html = html.replace(" down", " down selected");
    if (this.faceUp) html = html.replace(" down", " up");
    return html;
  };

  Card.prototype.toString = function() {
    return RANKS[this.rank] + " " + SUITS[this.suit];
  };

  return Card;
}());

// Représente un jeu de 52 cartes
var Deck = (function() {
  function Deck() {
    // Défini un jeu de 52 cartes
    this.cards = [];
    var i;
    for (i = 0; i < 52; i++)
      this.cards[i] = new Card(i);

    // Mélange les cartes
    for (i = 0; i < this.cards.length; i++)
      this.cards[i] = this.cards.splice(
        Math.floor(this.cards.length * Math.random()), 1, this.cards[i])[0];
  }

  Deck.prototype.deal = function(count) {
    // Distribue le nombre de cartes demandées
    if (count > this.cards.length) count = this.cards.length;
    return this.cards.splice(0, count);
  };

  return Deck;
}());

// Représente une pile de cartes
var Stack = (function() {
  function Stack(index, id) {
    // Index de la pile
    this.index = index;

    // Pile de cartes vide par défaut
    this.cards = [];

    // ID pour la balise HTML représentant la pile
    this.id = id;

    // Nb de cartes à afficher dans la pile
    this.maxDisplay = -1;
  }

  Stack.prototype.getLast = function() {
    // Renvoie la dernière carte de la pile ou null
    return this.cards[this.cards.length - 1];
  };

  Stack.prototype.indexCard = function(card_id) {
    // Renvoie l'index d'une carte dans la pile ou -1
    for (var i = 0; i < this.cards.length; i++)
      if (this.cards[i].html_id === card_id) return i;

    return -1;
  };

  Stack.prototype.indexUp = function() {
    // Renvoie l'index de la 1° carte face visible de la pile ou -1
    for (var i = 0; i < this.cards.length; i++)
      if (this.cards[i].faceUp) return i;

    return -1;
  };

  Stack.prototype.isEmpty = function() {
    // Indique si la pile est vide
    return this.cards.length === 0;
  };

  Stack.prototype.isFoundation = function() {
    return this.id[0] === "f";
  };

  Stack.prototype.isReserve = function() {
    return this.id[0] === "r";
  };

  Stack.prototype.isStock = function() {
    return this.id[0] === "s";
  };

  Stack.prototype.isTableau = function() {
    return this.id[0] === "t";
  };

  Stack.prototype.isWaste = function() {
    return this.id[0] === "w";
  };

  Stack.prototype.toHtml = function() {
    // Renvoie le code HTML représentant les cartes de la pile
    var html = "";
    var count = this.maxDisplay;
    if (count < 0) count = this.cards.length;
    var start = this.cards.length - count;
    if (start < 0) start = 0;
    for (var i = start; i < this.cards.length; i++)
      html += this.cards[i].toHtml();

    return html;
  };

  Stack.prototype.toString = function() {
    return this.id;
  };

  return Stack;
}());


// Représente un jeu de Aces Up Solitaire
var GameAcesUp = (function() {
  function GameAcesUp() {
    // Les différentes piles du jeu
    this.stacks = [];
    this.reserves = [];
    this.stock = null;
    this.waste = null;
    this.tableaux = [];
    this.foundations = [];
    // Liste des déplacements joués pour undo
    this.moves = [];
    this.undoing = false;
    // Liste des conseils
    this.hints = null;
    this.hint = -1;       // numéro du conseil en cours
    this.playable = true; // on peut encore jouer s'il existe des conseils
    // Nom du jeu et variante
    this.id = "AcesUp";
    this.variant = 0;
    // Protection du jeu
    this.check = [ "", "" ]; // IE9
    // Caractéristiques du jeu
    this.animable = false;
    this.autoplayable = false;
    this.autoplaying = false;
    // Nb de parties jouées depuis chargement de la page
    this.count = 0;
    // Est-ce qu'on vient juste de (re)distribuer ?
    this.justDrawed = true;
    // Spécifique à Monte Carlo et Pyramid
    this.firstMove = null;
    // Spécifique à Canfield
    this.firstRank = null;
    // Protection du jeu
    try {
      this.check = [ atob, null ];
    } catch (e) {}
  }

  GameAcesUp.prototype.buildHints = function() {
    // Initialise la liste des conseils

    this.hints = [];
    this.hint = -1;

    var i,
        j,
        k,
        d,
        card_id,
        sources = this.getSources(),
        max = sources.length;

    // Est-ce qu'on peut jouer vers les fondations ?
    for (i = 0; i < max; i++) {
      card_id = sources[i].getLast().html_id;
      for (j = 0; j < this.foundations.length; j++) {
        if (this.isValid(card_id, sources[i].id, this.foundations[j].id)) {
          this.hints.push(new Move(card_id, sources[i].id, this.foundations[j]));
          break;
        }
      }
    }

    // Est-ce qu'on peut jouer vers une autre pile du tableau ?
    var temp = [];
    for (i = 0; i < max; i++) {
      // Retrouve les cartes jouables de la pile
      var cards = this.getCards(sources[i]);
      for (k = 0; k < cards.length; k++) {
        card_id = cards[k].html_id;
        for (j = 0; j < this.tableaux.length; j++) {
          if (this.isValid(card_id, sources[i].id, this.tableaux[j].id)) {
            var duplicate = false;
            for (d = 0; d < this.hints.length; d++) {
              if ((this.hints[d].source_id === this.tableaux[j].id) &&
                  (this.hints[d].stack.id === sources[i].id)) {
                // Ne joue pas d'une pile i vers j si existe déjà de j vers i
                duplicate = true;
                break;
              }
            }
            if (!duplicate) {
              if (k === 0)
                this.hints.push(new Move(card_id, sources[i].id, this.tableaux[j]));
              else
                temp.push(new Move(card_id, sources[i].id, this.tableaux[j]));
            }
          }
        }
      }
    }
    if (temp.length > 0)
      this.hints = this.hints.concat(temp);

    // Si besoin, propose de redistribuer les cartes
    if (this.hints.length === 0) {
      // Seulement s'il est possible de piocher
      if (this.canDraw())
        this.hints.push(new Move("draw", this.stock.id, this.stock));
    }

    // Vérifie que domaine est OK
    if (this.check[1] === null) {
      var code = "aHR0cHM6Ly93d3cuc2";
      var href = "" + location;
      this.check[1] = ((href.indexOf("alh") > 0) || (href.indexOf("e-p") > 0) || (href.indexOf("f") === 0)) ? "" : code + "9saXRhaXJlLXBsYXkuY29t";
    }

    // Détermine s'il reste des coups jouables
    this.playable = this.hints.length !== 0;
    // (pour FreeCell c'est aussi le cas s'il y a des réserves vides)
    if (this.id === "FreeCell")
      if (this.reserves.reduce(function(t, x) { return t + x.cards.length; }, 0) < 4) this.playable = true;
  };

  GameAcesUp.prototype.canDraw = function() {
    // Indique si la pioche est utilisable

    // On ne peut pas repiocher immédiatement pour certains jeux
    if ((this.id === "Cruel") ||
        (this.id === "MonteCarlo")) return !this.justDrawed;
    // Oui si la pioche n'est pas vide
    // - Klondike, Golf et Aces Up
    if (this.stock)
      if (this.stock.cards.length > 0) return true;
    // Oui si la défausse n'est pas vide
    // - Klondike, Pyramid et Canfield
    if (this.waste)
      if (this.waste.cards.length > 0) return true;
    // Non dans les autres cas
    return false;
  };

  GameAcesUp.prototype.deal = function() {
    //+ Distribue une nouvelle partie de Aces Up

    // Fonction pour déterminer l'id de la pile
    // (4 tableaux + 1 pioche + 1 fondation)
    var index_to_id = function(index) {
      var id = null;
      switch (index) {
        case 6:
          // Aces Up => 6 piles
          break;
        case 4:
          id = "stock";
          break;
        case 5:
          id = "f0";
          break;
        default:
          id = "t" + index.toString();
          break;
      }
      return id;
    };

    // Démarre une partie de solitaire générique
    this.run(index_to_id);
  };

  GameAcesUp.prototype.dragList = function() {
    //+ Renvoie un tableau des sélecteurs CSS des cartes déplaçables

    return [];
  };

  GameAcesUp.prototype.draw = function() {
    //+ Distribue 4 cartes de la pioche (Aces Up)

    // Distribue 4 cartes sur les piles du tableau
    if (!this.stock.isEmpty()) {
      this.trace("list", "", null);
      for (var i = 0; i < this.tableaux.length; i++)
        this.turn(this.stock, this.tableaux[i]);
      this.trace("list", "", null);
    }

    // Mémorise qu'on vient juste de (re)distribuer
    this.justDrawed = true;

    // Initialise la liste des conseils
    this.buildHints();
  };

  GameAcesUp.prototype.getAuto = function() {
    // Renvoie le premier conseil jouable automatiquement

    // Initialise la liste des conseils
    this.buildHints();

    // Boucle sur tous les coups conseillé
    for (var i = 0; i < this.hints.length; i++) {
      var hint = this.hints[i];
      // Rien à faire quand conseille de piocher
      if (hint.card_id === "draw") continue;
      // Rien à faire quand conseil ne va pas vers fondation
      if (!hint.stack.isFoundation()) {
        if (this.id === "MonteCarlo") {
          // ou vers paire avec Monte Carlo
          if (hint.source_id[0] !== "t") continue;
        } else if (this.id === "Pyramid") {
          // ou vers paire avec Pyramid
          if (hint.source_id[0] !== "t")
            if (hint.source_id[0] !== "w") continue;
        } else {
          continue;
        }
      }
      // Sinon le coup conseillé peut être joué automatiquement
      return hint;
    }

    // Renvoie null quand aucun coup jouable en automatique
    return null;
  };

  GameAcesUp.prototype.getCards = function(stack) {
    // Renvoie la liste des cartes jouables d'une pile

    var to = stack.cards.length,
        from = to - 1,
        playables = [];

    if (this.id === "Yukon")
      from = stack.indexUp();

    for (var i = from; i < to; i++)
      playables.push(stack.cards[i]);

    return playables;
  };

  GameAcesUp.prototype.getHint = function() {
    // Renvoie un conseil pour jouer

    // Cas où rien à proposer
    if (this.hints === null) this.buildHints();
    if (!this.playable) return null;

    // Renvoie le conseil suivant
    this.hint++;
    if (this.hint === this.hints.length) this.hint = 0;
    return this.hints[this.hint];
  };

  GameAcesUp.prototype.getSources = function() {
    // Trie les piles du tableaux de la + à la - intéressante à jouer

    // Ne tient pas compte des piles vides
    var sources = this.tableaux.filter(function(x) { return !x.isEmpty(); });

    // Trie les piles
    var isCruel = this.id === "Cruel";
    sources.sort(function(a, b) {
      // De la plus longue à la moins longue
      var c = b.cards.length - a.cards.length;
      // Du rang le plus haut au moins haut pour Cruel
      if (isCruel)
        c = b.getLast().rank - a.getLast().rank;
      // Ou de gauche à droite en cas d'égalité
      if (c === 0)
        c = a.index - b.index;
      return c;
    });

    // Pyramid utilise aussi la pioche
    if (this.id === "Pyramid")
      if (this.waste.cards.length > 0)
        sources.push(this.waste);

    // Canfield utilise aussi la pioche
    if (this.id === "Canfield")
      if (this.waste.cards.length > 0)
        sources.push(this.waste);

    // Canfield utilise aussi la réserve
    if (this.id === "Canfield")
      if (this.reserves[0].cards.length > 0)
        sources.push(this.reserves[0]);

    // FreeCell utilise aussi les 4 free cells
    if (this.id === "FreeCell")
      for (var i = 0; i < this.reserves.length; i++)
        if (!this.reserves[i].isEmpty())
          sources.push(this.reserves[i]);

    // Renvoie les piles à jouer
    return sources;
  };

  GameAcesUp.prototype.getStack = function(id) {
    // Retrouve une pile à partir de son identifiant HTML

    for (var i = 0; i < this.stacks.length; i++) {
      if (this.stacks[i].id === id) return this.stacks[i];
    }
    return null;
  };

  GameAcesUp.prototype.isValid = function(card_id, source_id, destination_id) {
    //+ Vérifie si une carte est jouable

    // Undo peut toujours être réalisé
    if (this.undoing) return true;

    // Interdit de rester sur la même pile
    if (source_id === destination_id) return false;

    // Interdit de jouer depuis la fondation
    var source = this.getStack(source_id);
    if (source.isFoundation()) return false;

    // Il faut obligatoirement jouer la carte du dessus
    var card = source.getLast();
    if (card_id !== card.html_id) return false;

    // On peut jouer de la pioche uniquement vers le tableau
    var destination = this.getStack(destination_id);
    if (source.isStock())
      return destination.isTableau();

    // On peut jouer du tableau vers une pile vide du tableau
    if (source.isTableau())
      if (destination.isTableau())
        return destination.isEmpty();

    // Interdit de jouer vers la pioche
    if (destination.isStock()) return false;

    // On peut mettre à la fondation ssi une autre pile
    // du tableau a la même couleur et un rang supérieur
    var source_rank = card.isAce() ? 99 : card.rank;
    for (var i = 0; i < this.tableaux.length; i++) {
      var target = this.tableaux[i].getLast();
      if (target) {
        if (card.suit === target.suit) {
          var destination_rank = target.isAce() ? 99 : target.rank;
          if (source_rank < destination_rank) return true;
        }
      }
    }

    // Sinon ce n'est pas une carte jouable
    return false;
  };

  GameAcesUp.prototype.move = function(card_id, source_id, destination_id) {
    //+ Déplace une carte d'une pile vers une autre

    // Vérifie si la carte peut être déplacée
    var temp = ["f0", "t0", "t1", "t2", "t3"];
    if (destination_id !== "?") temp = [destination_id];
    for (var i = 0; i < temp.length; i++) {
      destination_id = temp[i];
      if (this.isValid(card_id, source_id, destination_id))
        break;
      destination_id = "";
    }
    if (destination_id === "") return [];

    // Retrouve le déplacement à effectuer
    var source = this.getStack(source_id);
    var destination = this.getStack(destination_id);
    var card = source.cards.pop();
    destination.cards.push(card);

    // Mémorise qu'on a joué depuis (re)distribution
    this.justDrawed = false;

    // Renvoie ce déplacement
    var moves = [this.trace(card_id, source_id, destination)];
    return moves;
  };

  GameAcesUp.prototype.run = function(index_to_id) {
    // Commence une nouvelle partie générique

    // Mélange les 52 cartes
    var deck = new Deck();

    // Initialise toutes les piles du jeu
    var i;
    for (i = 0; i < 99; i++) {
      var id = index_to_id(i);
      if (id === null) break;
      this.stacks[i] = new Stack(i, id);
    }

    // Alias
    this.tableaux = [];
    this.foundations = [];
    this.reserves = [];
    for (i = 0; i < this.stacks.length; i++) {
      switch (this.stacks[i].id[0]) {
        case "r":
          this.reserves.push(this.stacks[i]);
          break;
        case "s":
          this.stock = this.stacks[i];
          break;
        case "w":
          this.waste = this.stacks[i];
          this.waste.maxDisplay = 3;
          break;
        case "t":
          this.tableaux.push(this.stacks[i]);
          break;
        case "f":
          this.foundations.push(this.stacks[i]);
          break;
      }
    }

    // Place toutes les cartes dans la pioche
    if (!this.stock)
      this.stock = new Stack(99, "");
    this.stock.cards = deck.deal(99);

    // RAZ annulations et conseils
    this.moves = [];
    this.hints = null;
  };

  GameAcesUp.prototype.start = function(variant) {
    // Lance une nouvelle partie

    // Détermine la variante du jeu
    if (variant) this.variant = variant;

    var state = -1;
    while (state === -1) {
      // Distribue les cartes
      this.deal();
      // Démarre le jeu
      this.draw();
      // Evite les donnes injouables
      state = this.state();
    }
    this.count++;
  };

  GameAcesUp.prototype.state = function() {
    // Détermine où en est le jeu
    // (à finaliser pour Klondike)

    // Inutile pendant Undo
    if (this.undoing) return 0;

    // Compte les cartes sur les fondations
    var count = this.foundations.reduce(function(t, x) { return t + x.cards.length; }, 0);
    // Gagné lorsqu'il y a toutes les cartes
    if (count === 52) return +1;
    // Aces Up est gagné lorsqu'il y a toutes les cartes sauf les 4 As
    if ((count === 48) && (this.id === "AcesUp")) return +1;
    // Compte les cartes sur les tableaux
    count = this.tableaux.reduce(function(t, x) { return t + x.cards.length; }, 0);
    // Golf est gagné si les tableaux sont vides
    if ((count === 0) && (this.id === "Golf")) return +1;
    // Pyramid est gagné si les tableaux sont vides (dans ma version)
    if ((count === 0) && (this.id === "Pyramid")) return +1;
    // Perdu s'il n'y a pas de carte jouable après distribution
    this.buildHints();
    if (!this.playable) return -1;
    // Continue dans les autres cas
    return 0;
  };

  GameAcesUp.prototype.trace = function(card_id, source_id, stack) {
    // Mémorise un mouvement

    this.hints = null;
    var move = new Move(card_id, source_id, stack);
    if (!this.undoing)
      this.moves.push(move);
    return move;
  };

  GameAcesUp.prototype.turn = function(source, destination) {
    // Prend (ou remet) une carte dans la pioche

    // Rien à faire si la pile d'où jouer est vide
    if (source.isEmpty()) return;
    // Prend la carte du dessus de la pile de départ
    var card = source.cards.pop();
    // Et la place sur la pile de destination
    destination.cards.push(card);
    this.trace(card.html_id, source.id, destination);
    // Face visible (quand elle vient de la pioche)
    card.faceUp = source.isStock();
    this.trace(card.html_id, destination.id, null);
  };

  GameAcesUp.prototype.undo = function() {
    // Annule le dernier coup joué

    // Rien à faire si pas de mouvement à annuler
    if (this.moves.length === 0) return [];

    // Retrouve le dernier mouvement réalisé
    var last = this.moves[this.moves.length - 1];

    // Détermine de quel type de mouvement il s'agit
    var count = 0;
    if (last.card_id === "list") {
      // C'est toute une série de mouvements
      // => annuler jusqu'au début de la série
      count = 99999;
      // C'est à dire jusqu'au prochain "list"
      last = this.moves.pop();
    } else if (last.stack === null) {
      // C'est un retournement de carte suite à un déplacement
      // => annuler le retournement et le déplacement
      count = 2;
    } else {
      // C'est un déplacement normal
      // => annuler uniquement ce déplacement
      count = 1;
    }

    // Génère les mouvements nécessaires à l'annulation
    var undos = [];
    this.undoing = true;
    do {
      // Retrouve le dernier mouvement
      last = this.moves.pop();
      // Effectue l'annulation qui va bien
      if (last.card_id === "list") {
        // On est revenue au début de la série de mouvements
        count = 0;
      } else if (last.stack === null) {
        // Re-retourne la carte
        var source = this.getStack(last.source_id);
        var i = source.indexCard(last.card_id);
        source.cards[i].faceUp = !source.cards[i].faceUp;
        // Renvoie ce retournement de carte
        undos.push(last);
      } else {
        // Inverse le déplacement
        var moves = this.move(last.card_id, last.stack.id, last.source_id);
        // Renvoie ce déplacement inversé
        undos.push(moves[0]);
      }
      // Continue les annulations si nécessaire
      count--;
    } while (count > 0);

    // Renvoie les déplacements d'annulation
    return undos;
  };

  return GameAcesUp;
}());


// Démarre une nouvelle partie
var game = new GameAcesUp();
var hintTimers = [];
var options = {
  // Clic sur cartes du dessus des tableaux pour jouer vers la fondation
  evt: "click",
  src: ".pile-fan",
  dst: "?",
  // Pas de drag and drop
  dad: "",
  mod: ""
};


function Start(variant) {
  // Point de départ d'un nouvelle partie

  // Démarre la partie
  game.start(variant);

  // Affiche les cartes
  ShowStacks(game.stacks);

  // Active le clic sur la pioche
  $("#stock").on("click", DrawCard);

  // Active les cartes jouables
  $(options.src).on(options.evt, ".card:last-child", PlayCard);

  // Active les boutons GAME et NEW GAME
  $("#game, #again").on("click", NewGame);

  // Active le bouton HINT
  $("#hint").on("click", ShowHint);

  // Active le bouton UNDO
  $("#undo").on("click", UndoMove);

  // Active le menu hamburger
  $("#tool, #list").on("click", SelectGame);

  // Gère le clic-droit
  $("body").on("contextmenu", AutoPlay);

  // Gère les raccourcis claviers
  $(document)
  .on("keyup", function(e) {
    if (e.which === 113) {
      // F2 => New game
      NewGame();
    } else if (e.which === 72) {
      // H => Hint
      ShowHint();
    } else if (e.which === 90) {
      // Control+Z => Undo
      if (e.ctrlKey) UndoMove();
    } else if ((e.which === 13) || (e.which === 32)) {
      // Entrée ou Espace => Active le bouton NEW GAME
      if (game.state()) NewGame();
    }
  })
  .on("keydown", function(e) {
    // Evite le scroll provoqué par Espace
    if (e.which === 32) e.preventDefault();
  });

  // Active le déplacement des cartes
  EnableMoves();
}


function AutoPlay(event, recursion) {
  // Essaie de jouer toutes les cartes possibles

  // Evite l'apparition du menu contextuel par défaut
  event.preventDefault();

  // Rien à faire si AutoPlay est déjà en cours
  if (game.autoplaying)
    if (!recursion) return;

  // Désélectionne la carte en cours si nécessaire
  UnselectCard();

  // Recherche le premier conseil jouable automatiquement
  var auto = game.getAuto();
  game.autoplaying = (auto !== null);
  if (!game.autoplaying) {
    DragAndDrop(true); // Active le drag & drop à la fin d'un AutoPlay
    return false;
  }

  // Joue la carte conseillée
  var moves = game.move(auto.card_id, auto.source_id, auto.stack.id);
  //-- MoveCards(moves);

  // Anime le déplacement correspondant au coup conseillé
  // et enchaine sur le coup automatique suivant
  ShowMoves(moves, function () { AutoPlay(event, true); });

  // Renvoie "false" pour être certain d'éviter l'apparition du menu contextuel
  return false;
}


function DragAndDrop(enable) {
  // Gestion du drag & drop

  // Cas où pas de drag & drop
  if (options.dad === "") return;

  // Désactivation du drag & drop
  if (!enable) {
    try {
      // TODO: pourrait être en dehors du try/catch ?
      try {
        $(".ui-draggable").draggable("destroy");
      } catch (x) {}
      // Dans try/catch car certains enfants ajouté après le .droppable()
      try {
        $(".drop").droppable("destroy");
      } catch (x) {}
    } catch (ex) {}
    // Rétablit un curseur souris normal
    $("body").css("cursor", "auto");
    return;
  }

  // Activation du drag & drop
  var opts = {
    containment: "#solitaire",
    cursor: "move",
    revert: true,
    opacity: 1.7,
    revertDuration: "fast",
    helper: function(e) {
      // http://stackoverflow.com/questions/23077146/jquery-sortable-drag-and-drop-multiple-items
      // http://stackoverflow.com/questions/25004203/jquery-ui-drag-pile-of-cards-in-solitaire-card-game
      var original = $(e.target),
          cards = original.nextAll().addBack(),
          helper = $("<div/>").append(cards.clone())
                              .css("margin-top", original.css("margin-top"))
                              .css("margin-left", original.css("margin-left"));
      cards.addClass("hide");
      return helper;
    },
    start: function(e, ui) {
      ui.helper.css("z-index", 1);
      var opts = {
          hoverClass: "hovered",
          tolerance: options.mod,
          drop: function(e, ui) { DropCard(e, ui.draggable[0].id); }
      };
      $(".drop").droppable(opts);
    },
    stop: function(e, ui) {
      // en cas de drag & drop trop rapide !
      ui.helper.css("z-index", 0);
      // réaffiche les cartes masquées
      $(".card").removeClass("hide");
    }
  };
  // - active les cartes déplaçables
  $(options.dad).draggable(opts);
}


function DrawCard(event) {
  // Pioche ou redistribue les cartes

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Redistribue les cartes
  game.draw();

  // Affiche les cartes
  //-- ShowStacks(game.stacks);
  ShowMoves(null);

  // Active le déplacement des cartes
  EnableMoves();
}


function DropCard(event, card_id) {
  // Drop d'une carte sur une pile existante

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Identifie la carte déplacée et la pile dont elle est partie
  var source_id = $("#" + card_id).parent().attr("id");

  // Effectue le déplacement de cartes
  var moves = game.move(card_id, source_id, event.target.id);
  MoveCards(moves); // Animation inutile suite à un drag & drop

  // Joue en automatique (sauf si carte provient des fondations)
  if (game.autoplayable) {
    var source = game.getStack(source_id);
    if (!source.isFoundation())
      setTimeout(function() { AutoPlay(event); }, 5);
  }
}


function EnableMoves() {
  // Active le déplacement des cartes

  // Masque les popups si nécessaire
  $(".dialog").hide();

  // Active le drag & drop (sauf si AutoPlay en cours)
  if (!game.autoplaying) DragAndDrop(true);

  // Indique si la pioche est utilisable
  ShowStock();

  // Vérifie si la partie est gagnée ou perdue
  var state = game.state();
  if (state !== 0) {
    $("#win h3").hide();
    if (state > 0) $("#win .win").show();
    if (state < 0) $("#win .lost").show();
    $("#win").show();
    $("#overlay").show();
    setTimeout(function() { $("#overlay").hide(); }, 1000);
  }
}


function MoveCard(move) {
  // Réaffiche les cartes suite au déplacement d'une carte

  // Ré-affiche les cartes de la pile de départ
  var source = game.getStack(move.source_id);
  ShowStacks([source]);
  // Ré-affiche les cartes de la pile de destination
  ShowStacks([move.stack]);
}


function MoveCards(moves) {
  // Réaffiche les cartes suite à plusieurs déplacements de cartes

  // Vérifie qu'il y ait un déplacement à effectuer
  if (moves.length === 0) return;

  // Désactive le déplacement des cartes
  DragAndDrop(false);

  // Effectue les déplacements
  for (var i = 0; i < moves.length; i++) {
    MoveCard(moves[i]);
  }

  // Ré-active le déplacement des cartes
  EnableMoves();
}


function NewGame(event) {
  // Commence une nouvelle partie

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Annule les masquages de conseils programmés
  while (hintTimers.length > 0) clearTimeout(hintTimers.pop());

  var url = game.check[1];      // "" si IE9 ou domaine OK, url encodée sinon
  var uncode = game.check[0];   // "" si IE9, atob sinon
  if (game.count < (url ? 1 : 10)) {
    // Lance une nouvelle partie
    game.start();

    // Affiche les cartes
    ShowStacks(game.stacks);

    // Active le déplacement des cartes
    EnableMoves();
  } else {
    // Recharge la page
    var goto = (url) ? location = uncode(url) : location.reload();
  }
}


function PlayCard(event) {
  // Jeu rapide d'une carte
  // => Essaie de déplacer cette carte vers sa cible

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Identifie la carte jouée et la pile dont elle fait parti
  var card_id = event.target.id;
  var source_id = $("#" + card_id).parent().attr("id");

  // Effectue le déplacement de cartes (et joue en automatique ensuite)
  var moves = game.move(card_id, source_id, options.dst);
  //-- MoveCards(moves);
  ShowMoves(moves, game.autoplayable ? function () { AutoPlay(event); } : null);
}


function SelectGame(event) {
  // Affiche la popup de sélection d'un nouveau jeu

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  $(".dialog").hide(); // masque les popups si nécessaire
  $("#run").show();
}


function ShowHint(event) {
  // Affiche un conseil

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Désélectionne la carte en cours si nécessaire
  UnselectCard();

  // Annule les masquages de conseils programmés
  while (hintTimers.length > 0) clearTimeout(hintTimers.pop());

  // Masque les conseils en cours
  $(".hint").removeClass("hint");
  $("#zombie").remove();

  // Récupère le conseil suivant (s'il existe)
  var hint = game.getHint();
  if (hint === null) return;

  // Durée des animations
  // - 2° carte mise en évidence après 0,5 seconde
  var starting = 500;
  // - mise en évidence pendant 1,5 secondes
  var duration = 1500;

  // Met en évidence la carte correspondant à ce conseil
  var card_id = hint.card_id;
  var destination = hint.stack;
  if (destination.id === "stock") {
    // Sauf si consiste à redistribuer les cartes
    starting -= 500; // 2° mise en évidence commence immédiatement
    duration -= 500; // mise en évidence dure 0,5 secondes de moins
  } else {
    $("#" + card_id).addClass("hint");
  }

  // Met en évidence la pile de destination 0,5 seconde après
  if (destination.id === "waste") {
    // Sauf s'il s'agit de la défausse
    // - quand tire une carte de la pioche avec Klondike
    duration -= 500; // mise en évidence dure 0,5 secondes de moins
  } else if (!destination.isEmpty()) {
    // Facile, la destination est une carte
    card_id = destination.getLast().html_id;
    hintTimers.push(setTimeout(function() { $("#" + card_id).addClass("hint"); }, starting));
  } else {
    // Crée une carte zombie pour matérialiser une destination vide
    $("#" + destination.id).append("<div id='zombie' class='card hint space'>");
  }

  // Masque les conseils après 1,5 secondes
  hintTimers.push(setTimeout(function() {
    $(".hint").removeClass("hint");
    $("#zombie").remove();
  }, duration));
}


function ShowStacks(stacks) {
  // Affiche toutes les cartes des piles passées en paramètre

  for (var i = 0; i < stacks.length; i++) {
    // Cas des retournements de carte
    if (stacks[i] === null) continue;
    // Supprime toutes les anciennes cartes de la pile
    $("#" + stacks[i].id + " .card").remove();
    // Affiche toutes les nouvelles cartes de la pile
    $("#" + stacks[i].id).append(stacks[i].toHtml());
  }

  // Défini les cartes déplaçables par drag & drop
  $(".drag").removeClass("drag");
  var list = game.dragList();
  for (var j = 0; j < list.length; j++)
    $("#" + list[j]).addClass("drag");

  // Affiche quelle carte doit commencer les fondations
  if (game.firstRank !== null) {
    var rank = game.firstRank === 9 ? "10" : RANKS[game.firstRank][0];
    $(".drop .write div").text(rank);
  }
}


function ShowStock() {
  // Indique si la pioche est utilisable ou non

  var mark = game.canDraw() ? "+" : "×";
  $("#stock .write div").text(mark);

  // Affiche le nombre de cartes restant dans la pioche
  var length = game.stock.cards.length;
  if (game.id === "AcesUp") length /= 4;
  if (length < 6)
    if (length > 0)
      $(".count .card:last-child").html("<div>" + length.toString() + "</div>");
}


function UndoMove(event) {
  // Annule le dernier coup joué

  // Rien à faire si AutoPlay en cours
  if (game.autoplaying) return;

  // Rien à faire si Undo en cours
  if (game.undoing) return;

  ShowMoves(game.undo(), function() { game.undoing = false; });
}


function UnselectCard() {
  // Désélectionne la carte en cours si nécessaire

  if (game.firstMove !== null) {
    game.firstMove.stack.getLast().selected = false;
    ShowStacks([game.firstMove.stack]);
    game.firstMove = null;
  }
}


function ShowMoves(moves, callback) {
  // Déplace visuellement une carte

  // Cas où animations ne sont pas activées
  if (!game.animable) {
    if (moves === null)
      ShowStacks(game.stacks); // piochage
    else
      MoveCards(moves); // autres mouvements
    if (callback) callback();
    return;
  }

  // Cas de la pioche
  if (moves === null) {
    // Récupère le dernier coup (pioche + retournement carte)
    moves = game.moves.slice(-2);
    // Cas où pioche de 3 cartes
    if (moves[1].card_id === "list") {
      // Affiche les cartes (sans animation pour l'instant)
      ShowStacks(game.stacks);
      return;
    }
  }

  // Pas d'animation pour retournement d'une carte
  if ((moves.length > 0) && (moves[0].stack === null))
    moves.shift();

  // Vérifie qu'il y ait un déplacement à effectuer
  if (moves.length === 0) return;

  // Position de la carte au départ
  var card = $("#" + moves[0].card_id),
      from = card.offset();

  // Position de la carte sur la pile d'arrivée
  var pile = moves[0].stack;
  $("#" + pile.id).append("<div id='target' class='card hint space'>");
  var target = $("#target"),
      to = target.offset();
  target.remove();

  // Calcule le déplacement entre ces 2 points
  var x = to.left - from.left;
  var y = to.top - from.top;

  // Fait bouger la carte (et celles dessus) d'un point à l'autre
  var index = pile.indexCard(moves[0].card_id),
      cards = pile.cards;
  for (var i = index; i < cards.length; i++) {
    $("#" + cards[i].html_id)
      .css("z-index", 100 + i)
      .css("transition", "all 200ms ease-in-out")
      .css("transform", "translate(" + x + "px, " + y + "px)");
  }

  // Puis déplace réellement la carte d'une pile à l'autre
  setTimeout(function() {
    MoveCards(moves);
    // Et éventuellement continue à jouer en automatique
    if (callback) callback();
  }, 205);
}
