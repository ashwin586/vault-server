import { Response } from "express";
import User from "../models/users";
import SavedPassword from "../models/savedPasswords";
import { decrypt, encrypt } from "../utils/crypto";
import { AuthRequest } from "../types/interface";

const profileControllers = {
  fetchProfile: async (req: AuthRequest, res: Response) => {
    try {
      const userInfo = req.user;
      const user = await User.findOne({ email: userInfo?.email });
      const userDetails = {
        name: user?.name,
        email: user?.email,
        createdAt: user?.createdAt,
      };
      res.status(200).json({ user: userDetails });
      return;
    } catch (error: unknown) {
      console.error("Fetch Profile Error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  // updateProfile: async (req: AuthRequest, res: Response) => {
  //   try {
  //     const userInfo = req.user;
  //     const user = await User.findOne({ email: userInfo?.email });
  //     if (!user) {
  //       res.status(404).json({ message: "User not found" });
  //       return;
  //     }
  //     if (req.body.name !== undefined) user.name = req.body.name;

  //     const { currentPassword, newPassword } = req.body;
  //     if (currentPassword && newPassword) {
  //       const isMatch = await bcrypt.compare(currentPassword, user?.password!);
  //       if (!isMatch) {
  //         res
  //           .status(400)
  //           .json({ message: "Incorrect current password, Try again" });
  //         return;
  //       }
  //       user.password = await bcrypt.hash(newPassword, 10);
  //     }

  //     await user.save();
  //     res.json({ message: "Profile updated successfully" });
  //     return;
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ message: "Something went wrong" });
  //     return;
  //   }
  // },

  fetchPasswords: async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      const userId = await User.findOne({ email: user?.email });
      const userPasswords = await SavedPassword.find({ user: userId });
      const userCredentials = userPasswords.map((credentials) => ({
        id: credentials?._id,
        name: credentials?.name,
        url: credentials.url,
        userName: credentials.userName,
        password: decrypt(credentials.password, credentials.iv),
      }));
      res.status(200).json({ passwords: userCredentials });
      return;
    } catch (error) {
      console.error("Fetch Password Error", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  },

  addPasswords: async (req: AuthRequest, res: Response) => {
    try {
      const { name, password, url, userName } = req.body;
      const user = req.user;
      const userId = await User.findOne({ email: user?.email });
      const { iv, encryptedData } = encrypt(password);

      const appDetails = new SavedPassword({
        user: userId,
        name,
        url,
        userName,
        iv,
        password: encryptedData,
      });

      await appDetails.save();
      res.status(201).json({
        message: "Credentials added successfully",
        newData: {
          id: appDetails._id,
          name: appDetails.name,
          url: appDetails.url,
          userName: appDetails.userName,
          password: decrypt(appDetails.password, appDetails.iv),
        },
      });
      return;
    } catch (error) {
      console.error("Add password error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  updatePasswords: async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      const { name, password, url, userName } = req.body;
      const { id } = req.params;
      const userId = await User.findOne({ email: user?.email });
      const { iv, encryptedData } = encrypt(password);
      const updatedDetails = {
        user: userId,
        name,
        url,
        userName,
        iv,
        password: encryptedData,
      };
      const response = await SavedPassword.findByIdAndUpdate(
        id,
        updatedDetails,
        { new: true },
      );
      res.status(200).json({
        message: "Updated Credentials",
        updatedData: {
          id: response?._id,
          name: response?.name,
          userName: response?.userName,
          password: response?.password,
          url: response?.url,
        },
      });
      return;
    } catch (error) {
      console.error("Update password error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  deletePasswords: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await SavedPassword.findByIdAndDelete(id);
      res.status(200).json({ message: "Credential deleted successfully" });
      return;
    } catch (error) {
      console.error("Delete password error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  importCSV: async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      const userId = await User.findOne({ email: user?.email });
      const savedEntries = [];
      let skipped = 0;
      const { csvData } = req.body;
      for (const entry of csvData) {
        if (!entry.name || !entry.url || !entry.username || !entry.password) {
          skipped++;
          continue;
        }
        const existing = await SavedPassword.findOne({
          user: userId,
          url: entry.url,
          userName: entry.username,
        });
        if (existing) {
          skipped++;
          continue;
        }
        const { iv, encryptedData } = encrypt(entry.password);
        const appDetails = new SavedPassword({
          user: userId,
          name: entry.name,
          url: entry.url,
          userName: entry.username,
          iv,
          password: encryptedData,
        });
        await appDetails.save();
        savedEntries.push({
          id: appDetails._id,
          name: appDetails.name,
          url: appDetails.url,
          userName: appDetails.userName,
          password: decrypt(appDetails.password, appDetails.iv),
        });
      }
      res.status(200).json({
        message: `${savedEntries.length} imported successfully${skipped > 0 ? `, ${skipped} skipped (duplicates or missing fields)` : ""}`,
        newData: savedEntries,
      });
    } catch (error) {
      console.error("Import CSV error", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

export default profileControllers;
