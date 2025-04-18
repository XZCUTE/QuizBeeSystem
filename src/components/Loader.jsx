import loader from "@/assets/loader.svg"

export default function Loader({ ...otherProps }) {
  return <img src={loader} alt="Loading" {...otherProps} />
}
