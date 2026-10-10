import { randomBytes, randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { writeFileSync } from "node:fs";
const users = ["a", "b"].map((n) => ({
  id: randomUUID(),
  email: `mido-v2-test-${n}-${randomBytes(5).toString("hex")}@example.invalid`,
  password: randomBytes(24).toString("base64url"),
}));
writeFileSync(".env.test-users.json", JSON.stringify(users), { mode: 0o600 });
const sql = users
  .map(
    (u) =>
      `insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000','${u.id}','authenticated','authenticated','${u.email}','${hashSync(u.password, 10)}',now(),now(),now(),'','','','');\ninsert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values(gen_random_uuid(),'${u.id}','${u.id}','{"sub":"${u.id}","email":"${u.email}","email_verified":true}','email',now(),now(),now());`,
  )
  .join("\n");
writeFileSync(".env.test-users.sql", sql, { mode: 0o600 });
console.log(
  "Prepared two temporary authentication fixtures; credentials remain in ignored local files.",
);
