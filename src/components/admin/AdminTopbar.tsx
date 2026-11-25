"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_ICON_STROKE, ADMIN_NAVIGATION } from "@/components/admin/adminNav";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import styles from "./admin.module.css";

interface AdminTopbarProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
}

const SEARCH_GROUPS = [
  { key: "pages" as const, heading: "Seções administrativas" },
];

export function AdminTopbar({
  onOpenMenu,
  menuOpen,
  menuButtonRef,
}: AdminTopbarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  const grouped = useMemo(() => ({ pages: ADMIN_NAVIGATION.flatMap(item => [item, ...(item.children ?? [])]).filter((item, index, all) => all.findIndex(other => other.href === item.href) === index && item.label.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))).map(item => ({ ...item, meta: "Abrir seção" })) }), [query]);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          setOpen(false);
          setQuery("");
        } else {
          setOpen(true);
          setQuery("");
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      setQuery("");
    }
  }

  function openResult(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function handleLogout() {
    signOut();
    router.push("/acesso");
  }

  return (
    <>
      <header className={styles.topbar}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuBtn}
          aria-label="Abrir menu administrativo"
          aria-controls="admin-sidebar"
          aria-expanded={menuOpen}
          onClick={onOpenMenu}
        >
          <Menu size={20} strokeWidth={ADMIN_ICON_STROKE} aria-hidden="true" />
        </button>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Search size={16} strokeWidth={ADMIN_ICON_STROKE} />
          </span>
          <button
            ref={searchTriggerRef}
            type="button"
            className={styles.searchTrigger}
            aria-label="Abrir busca administrativa"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setQuery("");
              setOpen(true);
            }}
          >
            <span className={styles.searchTriggerText}>
              Buscar seções do painel...
            </span>
          </button>
          <kbd className={styles.kbd}>Ctrl + K</kbd>
        </div>

        <div className={styles.topbarRight}>
          <div className={styles.adminChip}>
            <UserRound size={16} strokeWidth={ADMIN_ICON_STROKE} aria-hidden="true" />
            <span className={styles.adminChipText}>
              <span className={styles.adminName}>{user?.name ?? "Administrador"}</span>
              <span className={styles.adminRole}>Admin</span>
            </span>
          </div>
          <button type="button" className={styles.topLogout} onClick={handleLogout}>
            <LogOut size={16} strokeWidth={ADMIN_ICON_STROKE} aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Busca administrativa"
        description="Encontre uma seção. Consulte registros reais na busca de cada listagem."
        className={styles.commandDialog}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          searchTriggerRef.current?.focus();
        }}
      >
        <Command shouldFilter={false} className={styles.commandRoot}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar seções do painel..."
            aria-label="Termo da busca administrativa"
          />
          <CommandList className={styles.commandList}>
            <CommandEmpty className={styles.searchEmpty}>
              {hasQuery
                ? `Nenhum resultado encontrado para “${query.trim()}”.`
                : "Digite o nome da seção que deseja abrir."}
            </CommandEmpty>

            {hasQuery
              ? SEARCH_GROUPS.map(({ key, heading }) => {
                  const items = grouped[key];
                  if (items.length === 0) return null;
                  return (
                    <CommandGroup
                      key={heading}
                      heading={heading}
                      className={styles.commandGroup}
                    >
                      {items.map((item) => (
                        <CommandItem
                          key={`${heading}-${item.id}`}
                          value={`${heading}:${item.id}:${item.label}`}
                          onSelect={() => openResult(item.href)}
                          className={styles.commandItem}
                        >
                          <span className={styles.commandItemContent}>
                            <span>{item.label}</span>
                            <span className={styles.searchResultMeta}>{item.meta}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })
              : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
