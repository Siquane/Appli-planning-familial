import { useEffect } from "react";
import { BackHandler } from "react-native";
import { router, type Href } from "expo-router";

/**
 * Retour en arrière, ou vers `fallback` quand il n'y a rien derrière : c'est
 * le cas d'un écran ouvert directement depuis un widget (« Ajouter une tâche »),
 * où router.back() ne fait rien.
 */
export function goBack(fallback: Href = "/home") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Même chose pour le bouton « retour » d'Android : sans écran derrière, il fermerait l'appli. */
export function useBackFallback(fallback: Href = "/home") {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) return false;
      router.replace(fallback);
      return true;
    });
    return () => sub.remove();
  }, [fallback]);
}
