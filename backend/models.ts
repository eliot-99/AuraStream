import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  emailCipher: { type: String, required: true }, // base64(encrypted)
  emailIv: { type: String, required: true },
  avatarCipher: { type: String, required: false }, // base64(encrypted)
  avatarIv: { type: String, required: false },
  passwordHash: { type: String, required: true }, // bcrypt hash
  // Password reset fields
  resetOtpHash: { type: String, required: false },
  resetOtpExpiresAt: { type: Date, required: false },
  resetToken: { type: String, required: false },
  resetTokenExpiresAt: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now }
});

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: any };
export const User = mongoose.model('User', UserSchema);

// Avoid model overwrite in watch mode
if (mongoose.models && mongoose.models.Room) {
  delete mongoose.models.Room;
}

const RoomSchema = new Schema({
  name: { type: String, required: true, unique: true, index: true },
  // Client-side derived password verifier (e.g., argon2id hash string). Server never sees plaintext.
  passVerifier: { type: String, required: true },
  privacy: { type: String, enum: ['public', 'private'], default: 'private' },
  expiresAt: { type: Date, required: true }
});

// TTL index for automatic room expiration
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RoomDoc = InferSchemaType<typeof RoomSchema> & { _id: any };
export const Room = mongoose.model('Room', RoomSchema);

// Share tokens for short-lived shareable links
if (mongoose.models && mongoose.models.ShareToken) {
  delete mongoose.models.ShareToken;
}
const ShareTokenSchema = new Schema({
  token: { type: String, required: true, unique: true, index: true },
  roomName: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true }
});
ShareTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ShareTokenDoc = InferSchemaType<typeof ShareTokenSchema> & { _id: any };
export const ShareToken = mongoose.model('ShareToken', ShareTokenSchema);