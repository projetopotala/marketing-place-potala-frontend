// Testes da política de redirecionamento do AuthGuard (checkout + Minha conta).
// Sem dependências: node:test + execução direta do .ts (Node >= 22.18):
//   node --test tests/unit/authGuardPolicy.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { getAuthGuardRedirect } from "../../src/components/auth/authGuardPolicy.ts";

test("cliente autenticado acessa checkout/conta (sem redirecionamento)", () => {
  assert.equal(getAuthGuardRedirect({ isAuthenticated: true, role: "customer" }), null);
});

test("vendedor autenticado COM sellerId também acessa checkout/conta (sem ir para /loja)", () => {
  assert.equal(getAuthGuardRedirect({ isAuthenticated: true, role: "seller" }), null);
});

test("vendedor autenticado sem sellerId resolvido também não é redirecionado (sem loop)", () => {
  // A política não depende de sellerId: nada aqui pode mandar o vendedor de
  // volta para /loja, então não existe ida-e-volta com o SellerAuthGuard.
  assert.equal(getAuthGuardRedirect({ isAuthenticated: true, role: "seller" }), null);
});

test("visitante não autenticado vai para /acesso", () => {
  assert.equal(getAuthGuardRedirect({ isAuthenticated: false }), "/acesso");
  assert.equal(getAuthGuardRedirect({ isAuthenticated: false, role: "seller" }), "/acesso");
});

test("administrador mantém o redirecionamento para /admin", () => {
  assert.equal(getAuthGuardRedirect({ isAuthenticated: true, role: "admin" }), "/admin");
});

test("nenhuma combinação autenticada redireciona para /loja", () => {
  for (const role of ["customer", "seller", "admin", undefined]) {
    assert.notEqual(getAuthGuardRedirect({ isAuthenticated: true, role }), "/loja");
  }
});
