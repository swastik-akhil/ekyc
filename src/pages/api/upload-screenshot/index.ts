// pages/api/upload-screenshot.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import AWS from 'aws-sdk';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import util from 'util';

const unlinkFile = util.promisify(fs.unlink);

// Setup AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

// Configure Multer
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
});

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    // Use multer to handle the upload
    upload.single('screenshot')(req as any, res as any, async (err: any) => {
      if (err) {
        return res.status(500).json({ error: 'Error processing file upload' });
      }
      
      const file = (req as any).file;
      
      if (!file) {
        return res.status(400).json({ error: 'No screenshot file uploaded' });
      }

      try {
        const uploadParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: `ekyc-decimus/development/${Date.now()}_${file.originalname}`,
          Body: file.buffer,
          ContentType: file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();

        res.status(200).json({ message: 'Screenshot uploaded successfully!', result });
      } catch (error) {
        console.error('Error uploading screenshot to S3', error);
        res.status(500).json({ error: 'Error uploading screenshot to S3' });
      }
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;
