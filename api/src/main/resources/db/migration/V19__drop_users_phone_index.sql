-- El acceso por telefono (SMS/OTP) se retiro: ya no se busca ninguna cuenta
-- por su numero, asi que el indice que creo V7 solo cuesta escrituras.
-- La columna users.phone se conserva: sigue siendo un dato de contacto del perfil.
DROP INDEX IF EXISTS idx_users_phone;
