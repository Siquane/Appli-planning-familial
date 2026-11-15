// Jeton Expo de ce téléphone, gardé ici (module sans dépendance) pour que la
// déconnexion puisse demander au serveur de l'oublier.
let current: string | null = null;
export const getPushToken = () => current;
export const setPushToken = (token: string | null) => {
  current = token;
};
