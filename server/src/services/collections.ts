// Remplacement d'une collection du compte.
//
// La regle metier vit ici, pas dans le gestionnaire HTTP : la route valide et
// delegue. Le client fait autorite sur la liste qu'il envoie ; le serveur la
// remplace, et rien d'autre. Un changement de profil ne touche pas aux
// trajets, un trajet invalide ne bloque pas le profil : chaque collection vit
// dans sa propre transaction, soit tout passe, soit la base reste telle
// quelle.
//
// Compromis assume : dernier ecrivain gagnant, a l'echelle de la collection.
// Deux appareils qui ecrivent la meme liste en meme temps se resolvent par le
// dernier arrive ; les autres listes ne sont pas concernees.
import type { Db } from '../db/index.ts';
import { createRepositories, type Repositories } from '../repositories/index.ts';

/** Ce qu'un depot de collection sait faire : lister, et remplacer en entier. */
export interface CollectionRepository<Input, Output> {
  list(userId: string): Output[];
  replaceAll(userId: string, items: Input[]): void;
}

/**
 * Remplace une collection et rend son contenu tel qu'il est desormais en
 * base. Les depots sont construits sur la transaction : une erreur en cours
 * de remplacement annule la suppression qui l'a precede.
 */
export function replaceCollection<Input, Output>(
  db: Db,
  userId: string,
  select: (repositories: Repositories) => CollectionRepository<Input, Output>,
  items: Input[],
): Output[] {
  return db.transaction((tx) => {
    const repository = select(createRepositories(tx));
    repository.replaceAll(userId, items);
    return repository.list(userId);
  });
}
