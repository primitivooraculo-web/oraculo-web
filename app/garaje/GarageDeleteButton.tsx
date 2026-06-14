"use client";

import { useEffect } from "react";

type SaveItem = { id: string; species?: string; status?: string };

function upper(el: Element | null) {
  return (el?.textContent || "").trim().toUpperCase();
}

function findSaveButton() {
  return Array.from(document.querySelectorAll("button, a"))
    .find((el) => upper(el).includes("GUARDAR DINOSAURIO")) as HTMLElement | undefined;
}

export default function GarageDeleteButton() {
  useEffect(() => {
    let saves: SaveItem[] = [];
    let busy = false;

    async function load() {
      const res = await fetch("/api/oraculo/garage/vault", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      saves = Array.isArray(data?.saves) ? data.saves : [];
      enhance();
    }

    function firstSave() {
      return saves.find((save) => save?.id && String(save.status || "").toLowerCase() !== "used");
    }

    async function deleteSave(btn: HTMLButtonElement) {
      const save = firstSave();
      if (!save) {
        alert("No tienes dinos guardados para eliminar.");
        return;
      }

      if (!confirm(`Eliminar ${save.species || "dino"} guardado?`)) return;

      busy = true;
      btn.disabled = true;
      btn.textContent = "ELIMINANDO...";

      const res = await fetch("/api/oraculo/garage/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId: save.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        busy = false;
        btn.disabled = false;
        btn.textContent = "ELIMINAR DINO GUARDADO";
        alert(data?.error || "No se pudo eliminar.");
        return;
      }

      location.reload();
    }

    function enhance() {
      const saveBtn = findSaveButton();
      if (!saveBtn) return;

      const parent = saveBtn.parentElement;
      if (!parent) return;

      parent.style.display = "flex";
      parent.style.justifyContent = "flex-end";
      parent.style.alignItems = "center";
      parent.style.gap = "10px";
      parent.style.flexWrap = "wrap";

      let btn = parent.querySelector("[data-oraculo-delete-save]") as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.oraculoDeleteSave = "true";
        btn.textContent = "ELIMINAR DINO GUARDADO";
        btn.style.border = "1px solid #b23224";
        btn.style.background = "rgba(90, 0, 0, 0.75)";
        btn.style.color = "#ffb199";
        btn.style.fontWeight = "900";
        btn.style.padding = "10px 16px";
        btn.style.cursor = "pointer";
        btn.style.textTransform = "uppercase";
        btn.addEventListener("click", () => deleteSave(btn!));
        saveBtn.insertAdjacentElement("afterend", btn);
      }

      if (!busy) {
        btn.disabled = false;
        btn.style.opacity = firstSave() ? "1" : "0.55";
        btn.textContent = "ELIMINAR DINO GUARDADO";
      }
    }

    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
