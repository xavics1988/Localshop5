---
trigger: always_on
---

# DOCUMENTO DE ESPECIFICACIÓN TÉCNICA (SRS) - PROYECTO LOCAL SHOP
MIGRACIÓN E IMPLEMENTACIÓN: BACKEND SUPABASE & INTERFAZ DUAL
[1. RESUMEN DEL PROYECTO Y OBJETIVO]

Local - SHOP es un marketplace de moda que conecta tiendas locales con consumidores europeos. El objetivo es migrar el prototipo actual (basado en localStorage y datos estáticos en data.ts) a una infraestructura profesional en Supabase (Auth, PostgreSQL y Storage). El sistema debe distinguir estrictamente entre dos tipos de interfaces: Cliente (compra) y Colaborador (gestión de tienda).


[2. ARQUITECTURA DE DATOS (SUPABASE DB)]
Implementar el esquema relacional desde cero. La base de datos será la "fuente de verdad" única.

Tabla profiles (Extensión de auth.users):

id (uuid, PK), full_name (text), location (text).

role: enum ('cliente', 'colaborador').

Tabla stores:


id (uuid, PK), owner_id (FK a profiles), name (text), address (text), city (default: 'Castellón').


subscription_status: Para gestionar la cuota de 2,49 €/mes.

Tabla products:

id (uuid, PK), store_id (FK), name, price (numeric), description, category.

image_url: URL vinculada a Supabase Storage (bucket product-images).

Tabla orders:

id (uuid, PK), client_id, store_id, total (numeric), status.


shipping_type: enum ('envío', 'recogida').


commission_fee: registro fijo de 2,99 € por unidad vendida.

[3. REGLAS DE NEGOCIO E IMPLEMENTACIÓN LÓGICA]
La IA debe asegurar que el código refleje las siguientes condiciones operativas:


Logística Inteligente: Si el total del carrito del cliente es ≥ 79 €, el shipping_cost se establece en 0 € para el cliente (asumido por la tienda en el desglose de la orden). Para montos inferiores, aplicar el rango de 4,95 € - 6,95 €.



Dualidad de Interfaces:

Registro/Login: Al detectar el role en el perfil, redirigir automáticamente:

cliente -> HomeScreen.tsx, DiscoverScreen.tsx, Cart.


colaborador -> Interfaz de gestión de inventario, subida de productos y panel de ventas.

Administración: El usuario Mario debe tener acceso a métricas globales de captación según el rol de administrador definido.

[4. REFACTORIZACIÓN TÉCNICA (FRONT-END)]
Sustitución de Persistencia: Eliminar toda la lógica de localStorage en AppContext.tsx y sustituirla por el cliente de Supabase (@supabase/supabase-js).

Auth Real: Migrar los formularios de AuthScreens.tsx a supabase.auth.signInWithPassword y signUp.

Multimedia: Implementar la subida de imágenes optimizadas por IA al bucket de Supabase Storage.

Tipado: Extender las interfaces en types.ts para que coincidan con las claves de la base de datos PostgreSQL.

[5. CUMPLIMIENTO LEGAL Y SEGURIDAD]
Jurisdicción: El sistema debe declarar que cualquier controversia se someterá a los tribunales de Castellón, España.

RLS (Row Level Security):

Los colaboradores solo pueden INSERT, UPDATE o DELETE sus propios productos.

Los clientes solo pueden visualizar productos y ver sus propios pedidos.

Permanencia: El acceso de los socios fundadores al control del sistema debe considerar el compromiso de permanencia de 2 años.

[INSTRUCCIONES DE EJECUCIÓN PARA ANTIGRAVITY]
Analiza la estructura dual: Revisa cómo el código actual separa las pantallas de Cliente y Colaborador en App.tsx.

Genera el Backend: Proporciona el script SQL completo para Supabase basado en el punto [2].

Limpia el Estado: Refactoriza AppContext.tsx para que la base de datos sea la única fuente de verdad, eliminando los mocks de data.ts.

No alteres la UI: Mantén el diseño actual de Tailwind CSS; céntrate exclusivamente en la lógica de persistencia y enrutamiento por roles.

Este documento consolida la visión de negocio, el pacto de socios y la arquitectura técnica necesaria para el lanzamiento de Local - SHOP.