import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  emailCipher: { type: String, required: true }, // base64(encrypted)
  emailIv: { type: String, required: true },
  passwordHash: { type: String, required: true }, // bcrypt hash
  createdAt: { type: Date, default: Date.now }
});

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: any };
export const User = mongoose.model('User', UserSchema);

const RoomSchema = new Schema({
  name: { type: String, required: true, unique: true, index: true },
  passHash: { type: String, required: true }, // sha256 of room password
  expiresAt: { type: Date, required: true }
});

export type RoomDoc = InferSchemaType<typeof RoomSchema> & { _id: any };
export const Room = mongoose.model('Room', RoomSchema);