export function StructuredData({ data }: { data: object | object[] }) {
	const structuredData = Array.isArray(data) ? data : [data]

	return (
		<>
			{structuredData.map((item, index) => (
				<script
					key={index}
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(item),
					}}
				/>
			))}
		</>
	)
}

