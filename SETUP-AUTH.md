# Configuración del login (Firebase Auth) — TripFund

Todo esto es **gratis** (plan Spark). Lo haces **una sola vez**. Las familias
**no se registran en ningún lado**: tú creas sus cuentas aquí y ellas solo
inician sesión y, si quieren, cambian su contraseña dentro de la app.

## 1. Habilitar el inicio de sesión por correo

1. Entra a la [consola de Firebase](https://console.firebase.google.com/) y abre tu proyecto.
2. Menú izquierdo → **Authentication** → botón **Comenzar** (si es la primera vez).
3. Pestaña **Sign-in method** → en la lista, elige **Correo electrónico/contraseña**.
4. Actívalo (el primer interruptor) y **Guardar**.

## 2. Crear la cuenta de cada familia

En **Authentication → Users → Agregar usuario**, crea una cuenta por cada familia
con estos correos (los mismos del archivo `src/App.jsx`, objeto `EMAILS`) y una
contraseña temporal cualquiera (mínimo 6 caracteres):

| Familia          | Correo(s) — cada uno es una cuenta aparte           |
|------------------|-----------------------------------------------------|
| Admin (tú)       | anyulrey@gmail.com                                  |
| Espinel Rey      | juanfespinel@gmail.com                              |
| Espinel Gómez    | diegomaximus@gmail.com · psicologacarolinagomez@gmail.com |
| Espinel López    | amparolopez009@gmail.com · franciscoespinel1@hotmail.com  |
| Alfonso Espinel  | mariapaulaespinel@gmail.com · fabuitrago92@gmail.com      |

> Una familia puede tener **varios correos** (varios miembros). Cada correo es una
> cuenta independiente en la consola, pero todos editan los datos de su misma familia.
> El inicio de sesión es **por correo + contraseña** (cada quien usa el suyo).

> **Recomendado:** usa el **correo real** de cada familia en vez de los
> `@tripfund.app`. Así el botón "Olvidé mi contraseña" les llega de verdad.
> Si cambias un correo aquí, cámbialo también en `src/App.jsx` (`EMAILS`) y en
> `firestore.rules` (`emailToKey`).

Luego le pasas a cada familia su contraseña temporal. Al entrar, pueden cambiarla
con el botón **Contraseña** (arriba a la derecha) o con **Olvidé mi contraseña**
en la pantalla de inicio (si usaste correos reales).

## 3. Publicar las reglas de seguridad

1. Consola → **Firestore Database** → pestaña **Reglas**.
2. Pega el contenido del archivo [`firestore.rules`](./firestore.rules).
3. **Publicar**.

Esto impide que alguien sin sesión lea o borre los datos, y que una familia
modifique los pagos de otra.

## 4. Crear los datos por primera vez

Inicia sesión como **admin** y registra cualquier valor: con eso se crea el
documento de pagos. (Las familias solo pueden editar su parte, no crear el
documento desde cero, por eso conviene que el primer guardado lo haga el admin.)

---

### Cómo cambian la contraseña las familias
- **Dentro de la app:** botón **Contraseña** → escriben la actual y la nueva.
- **Si la olvidaron:** en el login, eligen su familia y tocan **Olvidé mi
  contraseña**; les llega un enlace al correo (solo funciona con correos reales).
