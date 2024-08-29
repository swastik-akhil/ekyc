// import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client } from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import multer from 'multer';
import { NextApiHandler } from 'next';
import stream from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

// Configure AWS SDK v3
const s3 = new S3Client({
  region: process.env.UPLOAD_BUCKET_REGION, 
  credentials: fromEnv(),
});


const storage = multer.memoryStorage();
const upload = multer({ storage });


const uploadHandler: NextApiHandler = async (req, res) => {
  upload.single('video')(req as any, res as any, async (err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Error processing file', details: err.message });
    }

    try {
      const fileStream = new stream.PassThrough();
      fileStream.end((req as any).file.buffer);

      const uploadParams = {
        Bucket: process.env.UPLOAD_BUCKET_NAME,
        Key: `ekyc-decimus/development/${Date.now()}.webm`,
        Body: fileStream,
        ContentType: (req as any).file?.mimetype,
      };

      const upload = new Upload({
        client: s3,
        params: uploadParams,
      });

      const result = await upload.done();

      res.status(200).json({ message: 'Successfully uploaded to S3', data: result });
    } catch (uploadErr : any) {
      console.error('Error uploading to S3:', uploadErr);
      res.status(500).json({ error: 'Error uploading to S3', details: uploadErr.message });
    }
  });
};

export const config = {
  api: {
    bodyParser: false, 
  },
};

export default uploadHandler;
