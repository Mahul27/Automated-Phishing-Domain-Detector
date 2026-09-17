import Button from "./Button";

export default function ApiState({ loading, error, onRetry }) {
  if (!loading && !error) return null;

  return (
    <div
      className="state-box"
      style={{
        marginBottom: "20px",
        borderColor: error ? "#dc2626" : "#cbd5e1",
      }}
    >
      {loading && <p style={{ margin: 0 }}>Loading records from the backend...</p>}
      {error && (
        <>
          <p style={{ color: "#b91c1c", marginTop: 0 }}>{error}</p>
          <Button variant="outline" size="small" onClick={onRetry}>
            RETRY CONNECTION
          </Button>
        </>
      )}
    </div>
  );
}
