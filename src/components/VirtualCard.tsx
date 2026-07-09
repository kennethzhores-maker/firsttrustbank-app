import { useBankData } from "@/hooks/use-bank-data";

export default function VirtualCard() {
  const data = useBankData();

  const cardNumber = String(data.cardNumber || "");
  const masked = "•••• •••• •••• " + cardNumber.slice(-4);

  return (
    <div className="group perspective-1000">
      <div
        className="relative w-full max-w-[380px] aspect-[1.586/1] rounded-2xl p-6 flex flex-col justify-between
                    shine-effect cursor-pointer transition-transform duration-500 ease-out
                    group-hover:[transform:rotateY(6deg)_rotateX(4deg)]"
        style={{
          background: "linear-gradient(135deg, hsl(230 80% 50%), hsl(260 70% 40%), hsl(200 80% 45%))",
          boxShadow: "0 25px 50px -12px hsla(230, 80%, 40%, 0.4)",
        }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "hsla(0,0%,100%,0.6)" }}>
              Virtual Card
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="rounded-md bg-white/95 px-2 py-1 shadow-sm">
              <img
                src="/mastercard-logo.png"
                alt="Mastercard"
                className="h-7 w-auto object-contain"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Chip */}
        <div
          className="w-10 h-7 rounded-md"
          style={{
            background: "linear-gradient(135deg, hsl(45 80% 65%), hsl(35 70% 50%))",
          }}
        />

        {/* Card number */}
        <p className="font-mono text-lg tracking-[0.2em] font-medium" style={{ color: "hsla(0,0%,100%,0.9)" }}>
          {masked}
        </p>

        {/* Bottom row */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "hsla(0,0%,100%,0.5)" }}>
              Card Holder
            </p>
            <p className="text-sm font-semibold tracking-wide" style={{ color: "hsla(0,0%,100%,0.9)" }}>
              {data.cardholderName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "hsla(0,0%,100%,0.5)" }}>
              Expires
            </p>
            <p className="text-sm font-semibold" style={{ color: "hsla(0,0%,100%,0.9)" }}>
              {data.expiryDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
