'use client';

import { Alert, Button, Modal, QRCode } from 'antd';
import { useFossGuestQr } from '../hooks/use-foss-guest-qr';
import styles from './foss-guest-qr-actions.module.css';

type Props = { bookingReference: string };

/** The QR secret is only held in transient component memory. */
export function FossGuestQrActions({ bookingReference }: Props) {
  const issueMutation = useFossGuestQr();
  const data = issueMutation.data;

  const close = () => issueMutation.reset();

  return (
    <>
      <Button
        onClick={() => issueMutation.mutate(bookingReference)}
        loading={issueMutation.isPending}
        disabled={issueMutation.isPending}
      >
        Print FOSS QR
      </Button>

      {issueMutation.isError && (
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Unable to issue a FOSS guest QR."
          description={issueMutation.error instanceof Error ? issueMutation.error.message : 'Please try again.'}
        />
      )}

      <Modal
        open={Boolean(data)}
        onCancel={close}
        title="FOSS Guest QR — Print Preview"
        footer={
          <>
            <Button onClick={close}>Close</Button>
            <Button type="primary" onClick={() => window.print()} disabled={!data}>
              Open Print Dialog
            </Button>
          </>
        }
        destroyOnHidden
        width={460}
      >
        {data && (
          <div className={styles.slip}>
            <h2>FOREVER HOTEL</h2>
            <p>Guest Food Ordering Access</p>
            <h3>Room {data.roomNumber}</h3>
            <QRCode
              value={data.activationUrl}
              type="svg"
              size={230}
              color="#000000"
              bgColor="#ffffff"
              errorLevel="H"
              aria-label="FOSS guest activation QR code"
            />
            <p>Scan this QR using your phone camera to open the guest app.</p>
            <p>Keep this paper private. QR access expires at {new Date(data.expiresAt).toLocaleString()}.</p>
            {data.demo && <strong className={styles.demo}>DEMO ONLY — NOT VALID FOR GUEST LOGIN</strong>}
            <p className={styles.small}>Printing opens your browser's print dialog; paper delivery cannot be confirmed automatically.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
